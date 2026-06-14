create table if not exists content_campaigns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  goal text,
  target_platforms text[] default '{}',
  status text not null default 'planned',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table content_requests add column if not exists assignee_id uuid references agents(id);
alter table content_requests add column if not exists campaign_id uuid references content_campaigns(id);
alter table content_requests add column if not exists scheduled_at timestamptz;
alter table content_requests add column if not exists published_at timestamptz;
alter table content_requests add column if not exists engagement_likes integer default 0;
alter table content_requests add column if not exists engagement_shares integer default 0;
alter table content_requests add column if not exists engagement_comments integer default 0;
alter table content_requests add column if not exists platform_post_id text;
alter table content_requests alter column content_type drop default;
alter table content_requests add column if not exists hashtags text[] default '{}';
alter table content_requests add column if not exists target_audience text;

create index if not exists idx_content_assignee on content_requests(assignee_id);
create index if not exists idx_content_campaign on content_requests(campaign_id);
create index if not exists idx_content_scheduled on content_requests(scheduled_at);
create index if not exists idx_campaigns_user on content_campaigns(user_id);
alter table content_campaigns enable row level security;
create policy "Users see own campaigns" on content_campaigns for all using (auth.uid() = user_id);
