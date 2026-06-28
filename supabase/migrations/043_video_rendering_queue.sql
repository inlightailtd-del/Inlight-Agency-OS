-- Video Rendering Queue
-- Tracks video generation tasks (Runway, Veo, Pika, Kling, ElevenLabs, Whisper, etc.)

create table if not exists video_render_queue (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users(id) on delete cascade,
  video_project_id uuid references video_projects(id) on delete cascade,
  job_type        text not null,           -- voiceover | video_generation | thumbnail | subtitles | storyboard | b_roll | final_assembly
  provider        text not null,           -- runway | veo | pika | kling | elevenlabs | whisper | ai
  params          jsonb default '{}',
  status          text default 'queued',   -- queued | rendering | completed | failed
  output_url      text,
  thumbnail_url   text,
  error_msg       text,
  progress        integer default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_video_render_queue_user on video_render_queue(user_id, status);
create index if not exists idx_video_render_queue_project on video_render_queue(video_project_id);

-- Add subtitle fields to video_projects
alter table video_projects add column if not exists subtitle_url text;
alter table video_projects add column if not exists subtitle_language text default 'en';
alter table video_projects add column if not exists storyboard_json jsonb default '{}';
alter table video_projects add column if not exists b_roll_json jsonb default '[]';
alter table video_projects add column if not exists render_provider text;
alter table video_projects add column if not exists render_job_id text;

-- Enable RLS
alter table video_render_queue enable row level security;

create policy "Users see own render queue"
  on video_render_queue for all
  using (auth.uid() = user_id);
