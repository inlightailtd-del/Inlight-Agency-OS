alter table agents add column if not exists skills text[] default '{}';
alter table agents add column if not exists specialization text;
alter table agents add column if not exists training_count integer default 0;
alter table agents add column if not exists last_trained_at timestamptz;
alter table agents add column if not exists hired_at timestamptz default now();
alter table agents add column if not exists retired_at timestamptz;

create index if not exists idx_agents_skills on agents using gin(skills);
create index if not exists idx_agents_specialization on agents(specialization);
