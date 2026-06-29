-- Add social platform columns to clients table
alter table clients add column if not exists linkedin_url text;
alter table clients add column if not exists facebook_url text;
alter table clients add column if not exists instagram_url text;
alter table clients add column if not exists twitter_url text;
alter table clients add column if not exists tiktok_url text;
alter table clients add column if not exists youtube_url text;
alter table clients add column if not exists snapchat_url text;
