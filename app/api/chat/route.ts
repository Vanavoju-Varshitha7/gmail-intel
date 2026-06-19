import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: Request) {
  const session = await getServerSession(authOptions) as any
  if (!session) return Response.json({ error: 'Not logged in' }, { status: 401 })

  const { message, history } = await req.json()

  const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })
  const embeddingResult = await embeddingModel.embedContent(message)
  const queryVector = embeddingResult.embedding.values

  const { data: relevantEmails } = await supabase.rpc('search_emails', {
    query_embedding: queryVector,
    match_count: 8,
    user_email_param: session.user?.email
  })

  const emailContext = (relevantEmails || []).map((e: any) =>
    `---EMAIL---
From: ${e.sender}
Subject: ${e.subject}
Date: ${e.date}
Body: ${e.body?.slice(0, 500)}
---`
  ).join('\n')

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  const chat = model.startChat({ history: history || [] })

  const prompt = `You are an AI assistant that helps users understand their emails.
RULES:
- Answer ONLY using the emails provided below
- If answer is not in emails, say "I don't have that information in your emails"
- Always mention which email your answer comes from
- Never make up information

EMAILS:
${emailContext}

Question: ${message}`

  const result = await chat.sendMessage(prompt)
  const reply = result.response.text()

  return Response.json({ reply, emailsSearched: relevantEmails?.length || 0 })
}