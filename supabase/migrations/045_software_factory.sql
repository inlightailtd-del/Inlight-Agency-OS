-- Software Factory: SaaS blueprints, boilerplates, CI/CD, Docker, K8s, deployments, rollbacks, testing

alter table software_projects add column if not exists saas_blueprint jsonb default '{}';
alter table software_projects add column if not exists boilerplate_type text;
alter table software_projects add column if not exists repo_config jsonb default '{}';
alter table software_projects add column if not exists cicd_config jsonb default '{}';
alter table software_projects add column if not exists docker_config jsonb default '{}';
alter table software_projects add column if not exists k8s_config jsonb default '{}';
alter table software_projects add column if not exists test_framework text;
alter table software_projects add column if not exists tech_stack jsonb default '[]';

alter table deployments_sw add column if not exists build_log text;
alter table deployments_sw add column if not exists rollback_from text;
alter table deployments_sw add column if not exists rollback_to text;

alter table code_repositories add column if not exists visibility text default 'private';
alter table code_repositories add column if not exists license text;
alter table code_repositories add column if not exists branches jsonb default '["main"]';
alter table code_repositories add column if not exists workflows jsonb default '[]';
