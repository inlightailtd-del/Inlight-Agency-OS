-- Content Workflow Engine — schema extensions
-- Adds metadata column to content_requests for workflow tracking

alter table content_requests add column if not exists metadata jsonb default '{}';

-- Index for workflow lookups
create index if not exists idx_content_requests_metadata on content_requests using gin (metadata);
