-- TABLE: knowledge_docs (Company Brain)
create table if not exists knowledge_docs (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  title          text not null,
  content        text,
  category       text not null default 'general',  -- sop | wiki | policy | guide | template | general
  department     text,                              -- sales | marketing | design | development | hr | admin
  status         text not null default 'published', -- draft | published | archived
  tags           text[] default '{}',
  version        integer default 1,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_knowledge_docs_user on knowledge_docs(user_id);
create index if not exists idx_knowledge_docs_category on knowledge_docs(category);
create index if not exists idx_knowledge_docs_department on knowledge_docs(department);
create index if not exists idx_knowledge_docs_status on knowledge_docs(status);

alter table knowledge_docs enable row level security;
create policy "Users see own knowledge docs" on knowledge_docs for all using (auth.uid() = user_id);

-- TABLE: knowledge_doc_versions (Version History)
create table if not exists knowledge_doc_versions (
  id             uuid default gen_random_uuid() primary key,
  doc_id         uuid references knowledge_docs(id) on delete cascade,
  version        integer not null,
  title          text not null,
  content        text,
  changed_by     uuid references auth.users(id),
  change_summary text,
  created_at     timestamptz default now()
);

create index if not exists idx_knowledge_versions_doc on knowledge_doc_versions(doc_id);

alter table knowledge_doc_versions enable row level security;
create policy "Users see versions for own docs" on knowledge_doc_versions for select
  using (doc_id in (select id from knowledge_docs where user_id = auth.uid()));
create policy "Users can insert versions for own docs" on knowledge_doc_versions
  for insert with check (doc_id in (select id from knowledge_docs where user_id = auth.uid()));