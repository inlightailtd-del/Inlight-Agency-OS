# scope
- Only analyze the specific files the user mentions; do not scan additional files beyond what was requested. Confidence: 0.65
- When the user says "analyze only" or "do not modify code", do not propose code changes or use tools that modify files. Confidence: 0.85

# code-style
- Group technical audit/review reports into numbered sections with clear headings, tables, and completion percentages. Confidence: 0.70
- When the user requests a pre-deployment audit, execute the full numbered checklist (verify git remote, latest commit, branch, migrations, missing tables, .env, Vercel compatibility, OAuth callbacks, middleware/auth, production build), return structured tables for each check with status, provide exact deployment commands (git push, supabase migration apply, vercel deploy), and give a clear "READY FOR DEPLOYMENT" or "BLOCKERS FOUND" verdict. Confidence: 0.70

# workflow
See [workflow/taste.md](workflow/taste.md)
- Before integrating external repositories, APIs, or tools, first fully understand the existing codebase by reading all code, documentation, migrations, agents, database structures, and workflows; then document the complete system architecture, identify integration gaps, and create a dependency plan before pulling in any external resources. Confidence: 0.70

# testing
- During production verification/end-to-end testing, show full proof at each step (API response + database rows + success/failure status) before proceeding to the next step; do not claim success without verifiable evidence. Confidence: 0.70
- When the user explicitly demands "evidence only" verification mode, output raw evidence (API responses, DB rows, IDs, timestamps) without narrative summaries or assumptions; use a structured status format (VERIFIED / FAILED / MISSING) for each item. Confidence: 0.75
- When debugging a non-working feature during production verification, follow a two-phase audit structure: Phase 1 — produce a numbered checklist of checks performed, then return a structured report with exact failing component, exact error message, file causing error, fix required, and "Ready / Not Ready" status. Phase 2 — apply the fix, then verify with a real API call (no mocks) and show database proof. Confidence: 0.75
- When the user requests full validation of recently built features, run all five validation steps: (1) run pending migrations, (2) TypeScript typecheck, (3) production build, (4) fix ALL errors without exception, (5) test every execution mode with real evidence; do not start any new work until all five pass and evidence is shown. Confidence: 0.70

# architecture
- Design the Agent Runtime as generic infrastructure supporting scheduled, event-driven, and manual execution patterns, not tied to a single agent type or use case; support future multi-agent delegation as a first-class concern. Confidence: 0.70

# integrations
- Before executing OAuth flows (Facebook, LinkedIn, Gmail, etc.), first verify app registration details (App ID, redirect URI, required permissions, scopes), existing provider code status, and whether all prerequisite permissions exist in the external platform's app dashboard; return a structured "Ready / Not Ready" assessment with exact files/code changes required before proceeding. Confidence: 0.80
- When upgrading business intelligence modules from AI-assisted to data-driven, prioritize external API integrations in this order: 1) Google Trends, 2) SerpAPI, 3) Reddit, 4) YouTube, 5) LinkedIn, 6) Website Scraping. Confidence: 0.70

# database
- When rerunning or auditing migrations, first identify which statements already exist, which failed, and which are still missing; then create an idempotent version using IF NOT EXISTS guards (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, CREATE POLICY IF NOT EXISTS) and conditional checks to prevent duplicate-policy errors. Confidence: 0.70

# database
- When Docker is unavailable for local Supabase operations (db diff, migration list), use the Supabase Management API `/v1/projects/{ref}/database/query` endpoint with a PAT token to execute SQL DDL (CREATE TABLE, ALTER TABLE) and queries directly against the remote database; build combined migration files using Node.js scripts. Confidence: 0.70
- When a referenced entity (agent, user, etc.) does not exist, skip the dependent operation gracefully rather than auto-creating the entity. Confidence: 0.65
- When fixing migration ordering bugs involving foreign keys, do not remove existing FK constraints from the original migration; preserve all FK relationships by using a new migration file that adds constraints after dependencies exist. Confidence: 0.78
- For persisting workflow execution results, use append-only patterns (e.g., a new `orchestrator_tasks` row per run) instead of overwriting a single key-value memory entry, to preserve full execution history. Confidence: 0.75
- Use the existing `agent_memory` table and `storeMemory()` function to persist workflow step outputs, storing per-step data with category 'workflow_output' and tags for filtering. Confidence: 0.70
