import { google } from 'googleapis'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions) as any
  if (!session?.accessToken) {
    return Response.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { to, subject, body, threadId, messageId } = await req.json()

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })
  const gmail = google.gmail({ version: 'v1', auth })

  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body
  ]

  if (threadId) {
    emailLines.splice(3, 0, `In-Reply-To: ${messageId}`, `References: ${messageId}`)
  }

  const email = emailLines.join('\n')
  const encodedEmail = Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedEmail,
      ...(threadId && { threadId })
    }
  })

  return Response.json({ sent: true })
}