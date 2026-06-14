alter table agents add column if not exists tasks_completed integer default 0;
alter table agents add column if not exists level integer default 1;
alter table agents add column if not exists promoted_at timestamptz;

create index if not exists idx_agents_performance on agents(performance_score desc);
