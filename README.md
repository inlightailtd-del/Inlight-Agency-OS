# INLIGHT Agency OS

The Autonomous AI Operating System for Digital Agencies. Build by one person, for solo founders and small agencies.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ ([nodejs.org](https://nodejs.org/))
- A Supabase project (free at [supabase.com](https://supabase.com))

### 1. Clone & Install

```bash
cd inlight-agency-os
npm install
```

### 2. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine)
2. Go to **Settings** → **API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`

3. Create `.env.local` (use `.env.example` as template):
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

### 3. Set Up Database

1. In Supabase dashboard, go to **SQL Editor**
2. Create a new query
3. Copy & paste contents of `supabase/migrations/001_initial_schema.sql`
4. Run the query
5. Wait for completion (should see 14 tables created)

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Create an Account

- Sign up at the `/signup` page
- Verify your email (check inbox or Supabase email settings)
- Log in and you'll see the dashboard

## 📁 Project Structure

```
app/
├── (auth)/           # Public auth pages (login, signup)
├── (dashboard)/      # Protected dashboard pages
│   ├── clients/     # CRM - Coming in Week 2
│   ├── projects/    # Project management - Coming in Week 4
│   ├── tasks/       # Task management - Coming in Week 4
│   ├── finance/     # Invoices & expenses - Coming in Week 6
│   ├── brain/       # Company Brain - Coming in Week 9
│   └── agents/      # Agent monitoring - Coming in Week 11
├── page.tsx         # Home page
└── layout.tsx       # Root layout

components/
├── layout/          # Sidebar, Header components
├── ui/             # shadcn/ui components (auto-generated)
└── shared/         # Reusable components

lib/
├── supabase/       # Supabase clients & types
└── utils.ts        # Formatting & helper functions

supabase/
└── migrations/     # SQL migrations

.env.local          # Your secret environment variables
```

## 🎯 Development Phases

### Phase 1: Foundation (This Session - Weeks 1-4)
- ✅ Next.js + Supabase setup
- ✅ Authentication system
- ✅ App shell & routing
- ✅ Week 2: CRM (clients, contacts, interactions)
- ✅ Week 3-4: Project management with tasks

### Phase 2: Finance Module (Weeks 5-6)
- ✅ Invoices (create, list, view)
- ✅ Expense tracking
- ✅ Financial dashboard

### Phase 3: Company Brain (Weeks 7-9)
- ✅ Knowledge doc management (CRUD + versioning)
- ✅ pgvector extension installed
- ✅ Memory architecture (`agent_memory` table)
- → Vector search / RAG with AI

### Phase 4: Agent Runtime (Weeks 10-12)
- ✅ Agent Execution Engine (`lib/agents/runtime.ts`)
- ✅ Approval gate with autonomy levels (`lib/agents/approval.ts`)
- ✅ Project Monitor Agent (`lib/agents/project-monitor.ts`)
- ✅ Orchestrator dashboard with scheduled, manual, and event-driven execution
- ✅ API endpoints for runtime tick, delegation, and monitoring
- → Invoice Tracker Agent
- → Client Intelligence Agent

## 🔐 Authentication

Uses Supabase Auth with email/password:
- New users sign up at `/signup`
- Existing users log in at `/login`
- Session stored in cookies (server-safe)
- Protected routes automatically redirect to login

## 💾 Database

PostgreSQL via Supabase with 14 tables:
- **CRM**: profiles, clients, contacts, interactions
- **Projects**: projects, milestones, tasks
- **Finance**: invoices, invoice_items, expenses
- **AI**: memories (pgvector), agent_logs, notifications
- **Config**: settings

All data is user-isolated via Row Level Security (RLS).

## 🎨 Styling

- **Tailwind CSS** for utility-first styling
- **shadcn/ui** for accessible components (install as needed)
- **Color scheme**: Slate theme optimized for productivity apps
- **Currency**: PKR (Pakistani Rupees) throughout

## 📦 Key Dependencies

- `next@14`: React framework
- `@supabase/supabase-js`: Database & auth
- `tailwindcss`: Styling
- `react-hook-form`: Form management
- `lucide-react`: Icons
- `react-hot-toast`: Notifications
- `zod`: Schema validation

## 🛠 Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run type-check   # TypeScript checking
npm run format       # Format code with Prettier
```

## 🚨 Important Notes

### Environment Variables
- **Never commit `.env.local`** to git
- `NEXT_PUBLIC_*` variables are safe to expose (public)
- `SUPABASE_SERVICE_ROLE_KEY` is secret - keep it safe

### Database Migrations
- Always test migrations in Supabase SQL Editor first
- Migrations are cumulative (001, 002, 003, etc.)
- Currently only `001_initial_schema.sql` is needed

### Row Level Security
- All tables have RLS enabled
- Users can only see their own data
- Service role key can bypass RLS (for agents/backend tasks)

## 🎓 Next Steps

1. **Verify auth works**: Sign up, log in, verify you can see dashboard
2. **Test database**: Check Supabase **Table Editor** - should see 14 tables
3. **Start Week 2**: Begin building CRM pages for clients
4. **Refer to MVP Spec**: See `inlight-mvp-solo-spec.md` for detailed requirements

## 📚 Architecture Decision Records

- **Why Supabase?** Zero-ops database, built-in auth, free tier is generous
- **Why Tailwind?** Fast styling, small bundle size, utility-first
- **Why App Router?** Latest Next.js features, server components, better performance
- **Why TypeScript?** Type safety prevents bugs, great DX with IntelliSense

## 🐛 Troubleshooting

### "Cannot connect to Supabase"
- Check `.env.local` has correct URL and keys
- Verify you copied keys from correct project
- Check project is active in Supabase dashboard

### "Authentication not working"
- Check Supabase Auth is enabled (default is on)
- Verify email confirmation settings in Supabase
- Check browser cookies are enabled

### "Database tables not created"
- Run the SQL migration again in Supabase
- Check for error messages in SQL Editor
- Verify extensions are enabled (uuid, pgvector)

### "Sidebar not showing on mobile"
- Responsive design is built in
- Try toggling mobile menu button
- Check browser dev tools for layout issues

## 📄 License

Built for INLIGHT. Private use only during MVP phase.

## 🤝 Support

Refer to the comprehensive MVP spec: `inlight-mvp-solo-spec.md`

---

**Last Updated**: June 9, 2026  
**Phase**: Foundation (Phase 1)  
**Status**: Week 1 Complete ✅
