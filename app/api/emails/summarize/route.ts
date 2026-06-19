import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from '@/lib/supabase'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST() {
  const { data: emails } = await supabase
    .from('emails').select('id, subject, body')
    .is('summary', null).limit(10)

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  for (const email of emails || []) {
    const prompt = `Summarize this email in 2 sentences:
Subject: ${email.subject}
Body: ${email.body?.slice(0, 1000)}`

    const result = await model.generateContent(prompt)
    const summary = result.response.text()

    await supabase.from('emails').update({ summary }).eq('id', email.id)
    await new Promise(r => setTimeout(r, 500))
  }

  return Response.json({ done: true })
}