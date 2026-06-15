# Local Setup Guide — Inlight Agency OS

## Prerequisites

- **Node.js** 18+ (tested on v24.16.0)
- **npm** 9+
- **Supabase** account (free tier works)
- **Ollama** (optional, for local AI embeddings/agents)

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/inlightailtd-del/Inlight-Agency-OS.git
cd Inlight-Agency-OS

# 2. Install dependencies
npm install

# 3. Set up environment variables
copy .env.example .env.local
# Edit .env.local with your Supabase credentials (see "Environment" section)

# 4. Run database migrations
# Option A: Via Supabase CLI
supabase link --project-ref your-project-ref
supabase db push

# Option B: Via Supabase SQL Editor
# Open https://supabase.com/dashboard/project/your-project-ref/sql/new
# Paste and execute supabase/migrations/001_initial_schema.sql
# Then execute each migration file in order (002-040)

# 5. Start the development server
npm run dev

# 6. Open http://localhost:3000
# Create an account at /signup
# Start using the dashboard at /dashboard
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `NEXT_PUBLIC_APP_URL` | ✅ | `http://localhost:3000` for local |
| `CRON_SECRET` | ❌ | Token for cron endpoint auth |
| `GOOGLE_CLIENT_ID` | ❌ | For Gmail integration |
| `GOOGLE_CLIENT_SECRET` | ❌ | For Gmail integration |
| `LINKEDIN_CLIENT_ID` | ❌ | For LinkedIn integration |
| `LINKEDIN_CLIENT_SECRET` | ❌ | For LinkedIn integration |
| `FACEBOOK_CLIENT_ID` | ❌ | For Facebook integration |
| `FACEBOOK_CLIENT_SECRET` | ❌ | For Facebook integration |

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run type-check   # TypeScript type checking
npm run lint         # ESLint
```

## Project Structure

```
app/                  # Next.js App Router pages & API routes
  (auth)/             # Login & signup
  dashboard/          # 26+ dashboard modules with full CRUD
  api/                # 40 API routes
components/           # Shared UI components (shadcn-based)
lib/                  # Business logic layer
  supabase/           # Data access functions
  ai/                 # AI provider abstraction
  agents/             # Agent runtime & execution
  integrations/       # OAuth & third-party SDK
  + 20+ module dirs   # Business domain modules
supabase/migrations/  # 41 database migration files
docs/                 # Documentation (some aspirational)
```

## Database

- **Supabase project**: `wvintltwxydmlyvcmcis`
- **PostgreSQL** with pgvector extension for semantic search
- **Migrations**: 001-040 in `supabase/migrations/`
- All tables have **Row Level Security** enabled

## Recovery After PC Reset

1. Clone repo from GitHub
2. Copy `.env.local` from `Desktop\inlight_secrets_backup\` (or re-create from `.env.example`)
3. `npm install`
4. `npm run dev`

No database restore needed — Supabase is cloud-hosted. All data is in the `wvintltwxydmlyvcmcis` project.
