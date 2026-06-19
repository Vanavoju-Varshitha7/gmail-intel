# Gmail Intelligence Platform

An AI-powered Gmail assistant that connects to your Gmail account, processes emails intelligently, and provides a conversational AI interface to interact with, manage, and act on email data.

Live Demo

https://gmail-intel.vercel.app/dashboard

Features


Gmail Integration — Secure OAuth 2.0 login, syncs inbox emails and threads
Email Summarization — Auto-summarizes each email using Google Gemini AI
Email Categorization — Labels emails into Newsletter, Job/Recruitment, Finance, Notification, Personal, Work/Professional using NVIDIA NIM (Llama 3.1)
AI Chat Agent — Ask questions about your emails in natural language. Powered by RAG (Retrieval Augmented Generation) using pgvector
Compose with AI — Describe what you want to write, AI drafts the full email
Send Emails — Review AI draft and send directly from the app via Gmail API
Thread-Aware — Understands full email thread context for replies and summaries


Tech Stack

LayerTechnologyFrontendNext.js 14 (App Router)BackendNext.js API RoutesDatabaseSupabase (PostgreSQL + pgvector)Primary AIGoogle Gemini 1.5 Flash + text-embedding-004Secondary AINVIDIA NIM — meta/llama-3.1-8b-instructAuthNextAuth.js with Google OAuth 2.0GmailGoogle Gmail API v1DeploymentVercel

How It Works


User logs in with Google OAuth
App syncs emails from Gmail API and stores in Supabase
NVIDIA NIM categorizes each email automatically
Gemini summarizes each email
Gemini text-embedding-004 creates vector embeddings stored in pgvector
User asks questions → embeddings search finds relevant emails → Gemini answers with source attribution


Project Setup

Prerequisites


Node.js 18+
Supabase account (free)
Google Cloud Console project with Gmail API enabled
Google Gemini API key (free at aistudio.google.com)
NVIDIA NIM API key (free at build.nvidia.com)


Installation

bashgit clone https://github.com/YOUR_USERNAME/gmail-intel.git
cd gmail-intel
npm install --legacy-peer-deps

Environment Variables

Create a .env.local file in the root directory:

env# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_SECRET=any_random_secret_string
NEXTAUTH_URL=http://localhost:3000

# Supabase (from supabase.com project settings)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Keys
GEMINI_API_KEY=your_gemini_api_key
NVIDIA_API_KEY=your_nvidia_nim_api_key

Database Setup

Run this SQL in your Supabase SQL Editor:

sqlcreate extension if not exists vector;

create table emails (
  id uuid default gen_random_uuid() primary key,
  gmail_id text unique not null,
  thread_id text not null,
  user_email text not null,
  sender text,
  subject text,
  body text,
  date timestamp,
  category text,
  summary text,
  embedding vector(768),
  created_at timestamp default now()
);

create table sync_state (
  id uuid default gen_random_uuid() primary key,
  user_email text unique not null,
  history_id text,
  last_synced timestamp default now()
);

create index on emails using ivfflat (embedding vector_cosine_ops);

create or replace function search_emails(
  query_embedding vector(768),
  match_count int,
  user_email_param text
)
returns table (id uuid, sender text, subject text, body text, date timestamp, category text)
language sql stable
as $$
  select id, sender, subject, body, date, category
  from emails
  where user_email = user_email_param
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;

Running Locally

bashnpm run dev

Open http://localhost:3000

Folder Structure

gmail-intel/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # Google OAuth handler
│   │   ├── gmail/sync/route.ts           # Fetch and save emails from Gmail
│   │   ├── gmail/send/route.ts           # Send emails via Gmail API
│   │   ├── emails/categorize/route.ts    # NVIDIA NIM categorization
│   │   ├── emails/summarize/route.ts     # Gemini summarization
│   │   ├── emails/embed/route.ts         # Vector embeddings
│   │   └── chat/route.ts                 # AI chat agent (RAG pipeline)
│   ├── dashboard/page.tsx                # Main app UI
│   ├── providers.tsx                     # Session provider
│   └── layout.tsx                        # Root layout
├── lib/
│   ├── auth.ts                           # NextAuth config
│   └── supabase.ts                       # Supabase client
├── .env.example                          # Environment variables template
└── Architecture.md                       # System design document

Usage


Click Login with Google and authorize Gmail access
Click Sync My Emails — this fetches, categorizes, summarizes and indexes your emails
Ask questions in the chat box like:

"Which companies rejected my job application?"
"Summarize all emails from last week"
"What emails did I get about payments?"



Use Compose Email with AI to draft and send emails


Environment Variables Reference

VariableDescriptionWhere to get itGOOGLE_CLIENT_IDOAuth client IDconsole.cloud.google.comGOOGLE_CLIENT_SECRETOAuth client secretconsole.cloud.google.comNEXTAUTH_SECRETRandom secret stringAny random textNEXTAUTH_URLApp URLhttp://localhost:3000 (local) or Vercel URLNEXT_PUBLIC_SUPABASE_URLSupabase project URLsupabase.com project settingsNEXT_PUBLIC_SUPABASE_ANON_KEYSupabase public keysupabase.com project settingsSUPABASE_SERVICE_ROLE_KEYSupabase private keysupabase.com project settingsGEMINI_API_KEYGoogle Gemini API keyaistudio.google.comNVIDIA_API_KEYNVIDIA NIM API keybuild.nvidia.com

License

MIT
