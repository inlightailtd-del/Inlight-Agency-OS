alter table leads add column if not exists assignee_id uuid references agents(id);
alter table leads add column if not exists claimed_at timestamptz;
alter table leads add column if not exists last_contacted_at timestamptz;
alter table leads add column if not exists followup_count integer default 0;
alter table leads add column if not exists next_followup_at timestamptz;
alter table leads add column if not exists meeting_date timestamptz;
alter table leads add column if not exists proposal_sent_at timestamptz;
alter table leads add column if not exists lost_reason text;

create index if not exists idx_leads_assignee on leads(assignee_id);
create index if not exists idx_leads_followup on leads(next_followup_at);
