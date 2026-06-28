-- Automation Providers — Add Stripe, Calendly, HubSpot, Salesforce, Slack, Discord, Telegram, Airtable, n8n, make.com to integration_registry

insert into integration_registry (provider, name, description, category, auth_type, supports_oauth, supports_api_key, base_url, rate_limit_window, rate_limit_max) values
  ('stripe', 'Stripe', 'Payment processing, invoices, subscriptions', 'payments', 'api_key', false, true, 'https://api.stripe.com/v1', 60, 100),
  ('calendly', 'Calendly', 'Scheduling, event types, availability', 'scheduling', 'oauth', true, false, 'https://api.calendly.com', 60, 50),
  ('hubspot', 'HubSpot', 'CRM, contacts, deals, pipelines', 'crm', 'api_key', false, true, 'https://api.hubapi.com', 60, 100),
  ('salesforce', 'Salesforce', 'CRM, leads, opportunities, objects', 'crm', 'oauth', true, true, 'https://login.salesforce.com', 60, 100),
  ('slack', 'Slack', 'Messaging, channels, files, notifications', 'communication', 'api_key', false, true, 'https://slack.com/api', 60, 100),
  ('discord', 'Discord', 'Messaging, channels, roles, servers', 'communication', 'api_key', false, true, 'https://discord.com/api/v10', 60, 50),
  ('telegram', 'Telegram', 'Messaging, bots, channels, groups', 'communication', 'api_key', false, true, 'https://api.telegram.org', 60, 30),
  ('airtable', 'Airtable', 'Databases, records, bases, tables', 'data', 'api_key', false, true, 'https://api.airtable.com/v0', 60, 10),
  ('n8n', 'n8n', 'Workflow automation, webhooks, integrations', 'automation', 'api_key', false, true, 'http://localhost:5678', 60, 60),
  ('make', 'make.com', 'Scenario automation, webhooks, integrations', 'automation', 'api_key', false, true, 'https://eu1.make.com/api/v2', 60, 30)
on conflict (provider) do nothing;
