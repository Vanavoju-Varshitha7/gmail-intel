# Gmail Intelligence Platform — Architecture & Design Document

## Overview

Gmail Intelligence Platform is a full-stack AI-powered web application that connects to a user's Gmail account, intelligently processes emails, and provides a natural language interface to search, summarize, compose, and send emails.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                          │
│                  Next.js 14 Frontend (App Router)            │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────┐
│                     Vercel (Hosting)                         │
│                  Next.js API Routes (Backend)                │
│                                                              │
│  /api/auth/[...nextauth]  → Google OAuth handler            │
│  /api/gmail/sync          → Fetch emails from Gmail         │
│  /api/gmail/send          → Send emails via Gmail           │
│  /api/emails/categorize   → NVIDIA NIM categorization       │
│  /api/emails/summarize    → Gemini summarization            │
│  /api/emails/embed        → Vector embedding generation     │
│  /api/chat                → RAG-based AI chat agent         │
└───┬──────────────┬───────────────────┬──────────────────────┘
    │              │                   │
    ▼              ▼                   ▼
┌───────┐   ┌───────────┐     ┌───────────────┐
│ Gmail │   │ Supabase  │     │  AI Services  │
│  API  │   │PostgreSQL │     │               │
│       │   │+ pgvector │     │ Gemini 1.5    │
│ OAuth │   │           │     │ Flash         │
│ Send  │   │ emails    │     │               │
│ Fetch │   │ sync_state│     │ NVIDIA NIM    │
└───────┘   └───────────┘     │ Llama 3.1     │
                              │               │
                              │ text-         │
                              │ embedding-004 │
                              └───────────────┘
```

---

## Component Breakdown

### 1. Frontend (Next.js 14 App Router)

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout, wraps app with session provider |
| `app/providers.tsx` | NextAuth session provider |
| `app/dashboard/page.tsx` | Main UI — email list, chat, compose |

The frontend is a single-page dashboard that provides:
- Email list with category badges and AI summaries
- Chat interface for natural language queries
- Compose panel for AI-assisted email drafting
- Sync button to pull latest emails from Gmail

---

### 2. Authentication — NextAuth.js + Google OAuth 2.0

```
User clicks Login
      │
      ▼
NextAuth redirects to Google OAuth consent screen
      │
      ▼
Google returns auth code + access token + refresh token
      │
      ▼
NextAuth stores tokens in session
      │
      ▼
App uses access token to call Gmail API on behalf of user
```

- Provider: Google OAuth 2.0
- Scopes requested: `gmail.readonly`, `gmail.send`
- Tokens stored in NextAuth JWT session
- `NEXTAUTH_URL` must match the deployed domain exactly

---

### 3. Email Sync Pipeline (`/api/gmail/sync`)

```
Gmail API → Fetch emails (up to 50)
      │
      ▼
Parse sender, subject, body, date, thread_id
      │
      ├──► NVIDIA NIM (Llama 3.1) → Categorize email
      │         (Newsletter / Job / Finance / Notification / Personal / Work)
      │
      ├──► Gemini 1.5 Flash → Summarize email (2-3 sentences)
      │
      ├──► Gemini text-embedding-004 → Generate 768-dim vector embedding
      │
      └──► Supabase → Store all fields + embedding in emails table
```

---

### 4. AI Chat Agent — RAG Pipeline (`/api/chat`)

```
User types question
      │
      ▼
Gemini text-embedding-004 → Embed the question (768-dim vector)
      │
      ▼
Supabase pgvector → Cosine similarity search → Top-K relevant emails
      │
      ▼
Gemini 1.5 Flash → Answer question using retrieved emails as context
      │
      ▼
Return answer + source email references to user
```

This is a **Retrieval Augmented Generation (RAG)** pattern — instead of relying on the model's training data, it retrieves actual emails from the database to ground its answers.

---

### 5. Email Composition & Sending

```
User describes email intent (e.g. "Write a follow-up to interview")
      │
      ▼
Gemini 1.5 Flash → Draft full email (subject + body)
      │
      ▼
User reviews draft
      │
      ▼
/api/gmail/send → Gmail API sends email on behalf of user
```

---

## Database Schema (Supabase / PostgreSQL)

### `emails` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `gmail_id` | text | Unique Gmail message ID |
| `thread_id` | text | Gmail thread ID |
| `user_email` | text | Owner's email address |
| `sender` | text | From field |
| `subject` | text | Email subject |
| `body` | text | Full email body |
| `date` | timestamp | Sent date |
| `category` | text | AI-assigned category |
| `summary` | text | AI-generated summary |
| `embedding` | vector(768) | Semantic embedding for search |
| `created_at` | timestamp | Record creation time |

### `sync_state` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_email` | text | User identifier |
| `history_id` | text | Gmail history ID for incremental sync |
| `last_synced` | timestamp | Last sync timestamp |

### Vector Search

Uses `pgvector` extension with an `ivfflat` index for fast approximate nearest-neighbour search:

```sql
create index on emails using ivfflat (embedding vector_cosine_ops);
```

---

## AI Models Used

| Model | Provider | Purpose |
|-------|----------|---------|
| `gemini-1.5-flash` | Google Gemini | Email summarization, chat answers, email drafting |
| `text-embedding-004` | Google Gemini | Generating 768-dim vector embeddings |
| `meta/llama-3.1-8b-instruct` | NVIDIA NIM | Email categorization |

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS |
| Backend | Next.js API Routes (serverless) |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | NextAuth.js v4 with Google OAuth 2.0 |
| Primary AI | Google Gemini 1.5 Flash + text-embedding-004 |
| Secondary AI | NVIDIA NIM — Llama 3.1 8B Instruct |
| Gmail | Google Gmail API v1 |
| Deployment | Vercel |

---

## Deployment Architecture

```
GitHub Repository
      │
      │  git push
      ▼
Vercel (CI/CD auto-deploy)
      │
      ├── Production: gmail-intel.vercel.app (main branch)
      └── Preview:    gmail-intel-git-*.vercel.app (other branches)
```

Environment variables are set in Vercel dashboard and injected at build time. `NEXTAUTH_URL` must be set to the production domain (`https://gmail-intel.vercel.app`) for OAuth to work correctly.

---

## Security Considerations

- OAuth tokens are stored in encrypted JWT sessions (never exposed to client)
- `SUPABASE_SERVICE_ROLE_KEY` is server-side only (never prefixed with `NEXT_PUBLIC_`)
- Gmail API access is scoped to minimum required permissions
- All API routes validate the user session before accessing data
- Each user can only query their own emails (filtered by `user_email`)

---

## Design Decisions

### Why RAG instead of fine-tuning?
RAG allows the system to work with real-time, user-specific email data without retraining a model. It's also more cost-effective and privacy-preserving.

### Why pgvector instead of a dedicated vector DB?
Using Supabase's pgvector keeps the stack simple — one database handles both relational data (emails, sync state) and vector search. For this scale, it performs well without needing a separate service like Pinecone.

### Why two AI providers (Gemini + NVIDIA NIM)?
Gemini handles generative tasks (summarization, chat, drafting) while NVIDIA NIM's Llama model handles classification. This separation allows swapping either model independently.

### Why Next.js App Router?
App Router enables React Server Components, which reduces client-side JavaScript and allows direct server-side data fetching — important for an email-heavy app.
