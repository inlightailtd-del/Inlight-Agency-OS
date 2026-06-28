-- Website Factory: wireframes, design systems, themes, landing pages, SEO, Lighthouse, auto-deploy

alter table website_projects add column if not exists wireframe_blueprint jsonb default '{}';
alter table website_projects add column if not exists design_system jsonb default '{}';
alter table website_projects add column if not exists theme_config jsonb default '{}';
alter table website_projects add column if not exists landing_page_spec jsonb default '{}';
alter table website_projects add column if not exists seo_analysis jsonb default '{}';
alter table website_projects add column if not exists lighthouse_data jsonb default '{}';
alter table website_projects add column if not exists deploy_config jsonb default '{}';
alter table website_projects add column if not exists seo_title text;
alter table website_projects add column if not exists seo_description text;
