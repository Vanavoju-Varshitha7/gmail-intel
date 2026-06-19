import { supabase } from '@/lib/supabase'

export async function POST() {
  const { data: emails } = await supabase
    .from('emails').select('id, subject, body, sender')
    .is('category', null).limit(20)

  for (const email of emails || []) {
    const prompt = `Categorize this email into exactly ONE of these categories:
Newsletter, Job/Recruitment, Finance, Notification, Personal, Work/Professional

Email subject: ${email.subject}
From: ${email.sender}
Body preview: ${email.body?.slice(0, 300)}

Reply with only the category name, nothing else.`

    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 20
      })
    })

    const data = await res.json()
    const category = data.choices[0]?.message?.content?.trim()

    await supabase.from('emails').update({ category }).eq('id', email.id)
  }

  return Response.json({ done: true })
}