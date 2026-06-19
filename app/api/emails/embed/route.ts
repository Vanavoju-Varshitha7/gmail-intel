import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from '@/lib/supabase'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST() {
  const { data: emails } = await supabase
    .from('emails').select('id, subject, body')
    .is('embedding', null).limit(10)

  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })

  for (const email of emails || []) {
    const text = `Subject: ${email.subject}\n${email.body?.slice(0, 1000)}`
    const result = await model.embedContent(text)
    const embedding = result.embedding.values

    await supabase.from('emails').update({ embedding }).eq('id', email.id)
    await new Promise(r => setTimeout(r, 200))
  }

  return Response.json({ embedded: emails?.length })
}