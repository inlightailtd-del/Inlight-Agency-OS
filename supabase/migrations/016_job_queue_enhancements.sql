-- Add missing columns and cancelled status support
alter table job_queue add column if not exists progress_percentage integer default 0;
alter table job_queue add column if not exists execution_time_ms integer;
alter table job_queue drop constraint if exists job_queue_status_check;
alter table job_queue add constraint job_queue_status_check
  check (status in ('pending', 'running', 'completed', 'failed', 'cancelled'));

create index if not exists idx_job_queue_type on job_queue(job_type);
create index if not exists idx_job_queue_retry on job_queue(retry_count);
