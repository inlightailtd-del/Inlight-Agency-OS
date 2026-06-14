-- Add media columns to content_requests for image posts
alter table content_requests add column if not exists media_url text;
alter table content_requests add column if not exists media_asset_id text;
alter table content_requests add column if not exists image_count integer default 0;
alter table content_requests add column if not exists carousel_count integer default 0;

-- Storage bucket for content images will be created via API
