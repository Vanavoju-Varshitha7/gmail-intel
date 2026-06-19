import { google } from 'googleapis'
import { supabase } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST() {
  const session = await getServerSession(authOptions) as any
  if (!session?.accessToken) {
    return Response.json({ error: 'Not logged in' }, { status: 401 })
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })
  const gmail = google.gmail({ version: 'v1', auth })

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 50,
    labelIds: ['INBOX']
  })

  const messages = listRes.data.messages || []

  for (const msg of messages) {
    const { data: existing } = await supabase
      .from('emails').select('id').eq('gmail_id', msg.id).single()
    if (existing) continue

    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id! })
    const headers = full.data.payload?.headers || []
    const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)'
    const from = headers.find(h => h.name === 'From')?.value || ''
    const date = headers.find(h => h.name === 'Date')?.value || ''

    let body = ''
    const parts = full.data.payload?.parts
    if (parts) {
      const textPart = parts.find(p => p.mimeType === 'text/plain')
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8')
      }
    } else if (full.data.payload?.body?.data) {
      body = Buffer.from(full.data.payload.body.data, 'base64').toString('utf-8')
    }

    await supabase.from('emails').insert({
      gmail_id: msg.id,
      thread_id: full.data.threadId,
      user_email: session.user?.email,
      sender: from,
      subject,
      body: body.slice(0, 5000),
      date: new Date(date),
    })

    await new Promise(r => setTimeout(r, 100))
  }

  return Response.json({ synced: messages.length })
}