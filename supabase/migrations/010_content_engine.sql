create table if not exists content_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  content_type text not null default 'blog', -- blog | social_media | ad_copy | email | landing_page
  description text,
  platform text, -- linkedin | twitter | facebook | instagram | tiktok | blog | email
  tone text default 'professional', -- professional | casual | persuasive | informative | humorous
  status text not null default 'draft', -- draft | queued | generating | review | completed | failed
  word_count integer,
  generated_content text,
  feedback text,
  score integer default 0,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_content_requests_user on content_requests(user_id);
create index if not exists idx_content_requests_status on content_requests(status);
create index if not exists idx_content_requests_type on content_requests(content_type);
alter table content_requests enable row level security;
create policy "Users see own content requests" on content_requests for all using (auth.uid() = user_id);