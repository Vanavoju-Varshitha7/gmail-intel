'use client'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useState } from 'react'

function ComposeEmail() {
  const [prompt, setPrompt] = useState('')
  const [to, setTo] = useState('')
  const [draft, setDraft] = useState('')
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const generateDraft = async () => {
    if (!prompt) return
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Write a professional email for this request: ${prompt}. Return ONLY the email body, no subject line.`,
          history: []
        })
      })
      const data = await res.json()
      setDraft(data.reply || 'Could not generate draft. Please try again.')
      setSubject(prompt.slice(0, 50))
    } catch (err) {
      setDraft('Error generating draft. Please try again.')
    }
    setLoading(false)
  }

  const sendEmail = async () => {
    if (!to || !draft) return
    setLoading(true)
    await fetch('/api/gmail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body: draft })
    })
    setSent(true)
    setLoading(false)
    setPrompt('')
    setTo('')
    setDraft('')
    setSubject('')
  }

  return (
    <div>
      <input
        value={to}
        onChange={e => setTo(e.target.value)}
        placeholder="To: recipient@gmail.com"
        style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8, border: '1px solid #ddd', marginBottom: 8, boxSizing: 'border-box' as any }}
      />
      <input
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Describe what to write e.g. Follow up with Acme Corp about project"
        style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8, border: '1px solid #ddd', marginBottom: 8, boxSizing: 'border-box' as any }}
      />
      <button onClick={generateDraft} disabled={loading} style={{
        padding: '10px 20px', background: '#fbbc04', border: 'none',
        borderRadius: 8, cursor: 'pointer', fontSize: 14, marginBottom: 12
      }}>
        {loading ? 'Generating...' : 'Generate Draft with AI'}
      </button>

      {draft && (
        <div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={8}
            style={{ width: '100%', padding: 12, fontSize: 14, borderRadius: 8, border: '1px solid #ddd', boxSizing: 'border-box' as any, marginBottom: 8 }}
          />
          <button onClick={sendEmail} disabled={loading} style={{
            padding: '10px 20px', background: '#34a853', color: 'white',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14
          }}>
            {loading ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      )}
      {sent && <p style={{ color: 'green', marginTop: 8 }}>✓ Email sent!</p>}
    </div>
  )
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  if (status === 'loading') return <div style={{ padding: 40 }}>Loading...</div>

  if (!session) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Gmail Intelligence</h1>
      <p>Connect your Gmail to get started</p>
      <button onClick={() => signIn('google')} style={{
        padding: '12px 24px', background: '#4285f4',
        color: 'white', border: 'none', borderRadius: 8,
        fontSize: 16, cursor: 'pointer', marginTop: 16
      }}>
        Login with Google
      </button>
    </div>
  )

  const syncEmails = async () => {
    setLoading(true)
    setStatusMsg('Syncing emails from Gmail...')
    await fetch('/api/gmail/sync', { method: 'POST' })
    setStatusMsg('Categorizing emails with AI...')
    await fetch('/api/emails/categorize', { method: 'POST' })
    setStatusMsg('Summarizing emails...')
    await fetch('/api/emails/summarize', { method: 'POST' })
    setStatusMsg('Creating AI search index...')
    await fetch('/api/emails/embed', { method: 'POST' })
    setStatusMsg('✓ All done! You can now ask questions.')
    setLoading(false)
  }

  const askAI = async () => {
    if (!message.trim()) return
    const userMsg = message
    setMessage('')
    setLoading(true)
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }])

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMsg,
        history: chatHistory.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }]
        }))
      })
    })
    const data = await res.json()
    setChatHistory(prev => [...prev, { role: 'ai', text: data.reply }])
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Gmail Intelligence</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#666' }}>Hi {session.user?.name}</span>
          <button onClick={() => signOut()} style={{
            padding: '6px 14px', cursor: 'pointer', borderRadius: 6, border: '1px solid #ddd'
          }}>Logout</button>
        </div>
      </div>

      <div style={{ background: '#f8f9fa', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Step 1: Sync your emails</h2>
        <button onClick={syncEmails} disabled={loading} style={{
          padding: '10px 24px', background: loading ? '#ccc' : '#34a853',
          color: 'white', border: 'none', borderRadius: 8,
          fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer'
        }}>
          {loading ? 'Working...' : 'Sync My Emails'}
        </button>
        {statusMsg && <p style={{ margin: '10px 0 0', color: '#444' }}>{statusMsg}</p>}
      </div>

      <div style={{ background: '#f8f9fa', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Step 2: Ask about your emails</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && askAI()}
            placeholder="Which companies rejected my job application?"
            style={{
              flex: 1, padding: '10px 14px', fontSize: 14,
              borderRadius: 8, border: '1px solid #ddd', outline: 'none'
            }}
          />
          <button onClick={askAI} disabled={loading} style={{
            padding: '10px 20px', background: '#4285f4',
            color: 'white', border: 'none', borderRadius: 8,
            cursor: 'pointer', fontSize: 14
          }}>Ask</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {chatHistory.map((msg, i) => (
            <div key={i} style={{
              padding: '10px 14px',
              background: msg.role === 'user' ? '#e8f0fe' : '#ffffff',
              borderRadius: 8, border: '1px solid #e0e0e0'
            }}>
              <strong style={{ color: msg.role === 'user' ? '#1a73e8' : '#137333' }}>
                {msg.role === 'user' ? 'You' : 'AI'}:
              </strong>
              <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{msg.text}</p>
            </div>
          ))}
          {loading && <div style={{ padding: 10, color: '#666' }}>AI is thinking...</div>}
        </div>
      </div>

      <div style={{ background: '#f8f9fa', borderRadius: 12, padding: 20 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Step 3: Compose Email with AI</h2>
        <ComposeEmail />
      </div>
    </div>
  )
}