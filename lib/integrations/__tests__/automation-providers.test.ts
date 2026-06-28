import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  StripeProvider, PaddleProvider, ResendProvider,
  HubSpotProvider,
  CalendlyProvider,
  SalesforceProvider,
  SlackProvider,
  DiscordProvider,
  TelegramProvider,
  AirtableProvider,
  N8nProvider,
  MakeProvider,
} from '../automation-providers'
import type { SupabaseClient } from '@supabase/supabase-js'

const mockSupabase = {} as SupabaseClient
const userId = 'test-user-id'

function makeProvider<T>(Provider: new (supabase: SupabaseClient, userId: string, provider: string) => T, credentials: Record<string, any> = {}): T {
  const p = new Provider(mockSupabase, userId, 'test')
  ;(p as any).credentials = credentials
  return p
}

function mockResponse(data: any, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: { get: () => null },
  } as any as Response
}

beforeEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = vi.fn()
})

// ─── Stripe ────────────────────────────────────────────────────
describe('StripeProvider', () => {
  it('constructs with API key', () => {
    const p = makeProvider(StripeProvider, { api_key: 'sk_test_abc' })
    expect(p).toBeInstanceOf(StripeProvider)
  })

  it('throws on missing API key for actions', async () => {
    const p = makeProvider(StripeProvider, {})
    await expect((p as any).handleAction('create_payment', { amount: 10 })).rejects.toThrow('Stripe: no API key')
  })

  it('calls Stripe API for create_payment', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ id: 'pi_123', amount: 1000, currency: 'usd', status: 'requires_payment_method', client_secret: 'secret_123' }))
    const p = makeProvider(StripeProvider, { api_key: 'sk_test_abc' })
    const result = await (p as any).handleAction('create_payment', { amount: 10, currency: 'usd', description: 'Test payment' })
    expect(result.paymentIntent).toBe('pi_123')
    expect(fetch).toHaveBeenCalledWith('https://api.stripe.com/v1/payment_intents', expect.objectContaining({ method: 'POST' }))
  })

  it('calls create_invoice with items', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse({ id: 'inv_1', customer: 'cus_1' }))
      .mockResolvedValueOnce(mockResponse({}))
      .mockResolvedValueOnce(mockResponse({}))
      .mockResolvedValueOnce(mockResponse({ id: 'inv_1', total: 5000, status: 'open', hosted_invoice_url: 'https://stripe.com/inv/1', invoice_pdf: 'https://stripe.com/inv/1.pdf' }))
    const p = makeProvider(StripeProvider, { api_key: 'sk_test_abc' })
    const result = await (p as any).handleAction('create_invoice', { customer: 'cus_1', items: [{ description: 'Service', amount: 50 }] })
    expect(result.invoiceId).toBe('inv_1')
  })

  it('calls get_balance', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ available: [{ amount: 10000, currency: 'usd' }], pending: [{ amount: 2000, currency: 'usd' }] }))
    const p = makeProvider(StripeProvider, { api_key: 'sk_test_abc' })
    const result = await (p as any).handleAction('get_balance', {})
    expect(result.balance).toBe(100)
    expect(result.pending).toBe(20)
  })

  it('calls create_customer', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ id: 'cus_123', email: 'test@example.com', name: 'Test' }))
    const p = makeProvider(StripeProvider, { api_key: 'sk_test_abc' })
    const result = await (p as any).handleAction('create_customer', { email: 'test@example.com', name: 'Test' })
    expect(result.customerId).toBe('cus_123')
  })

  it('calls list_invoices', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ data: [{ id: 'inv_1', amount: 2000, status: 'paid', created: 1700000000 }] }))
    const p = makeProvider(StripeProvider, { api_key: 'sk_test_abc' })
    const result = await (p as any).handleAction('list_invoices', {})
    expect(result.invoices).toHaveLength(1)
  })

  it('throws on unknown action', async () => {
    const p = makeProvider(StripeProvider, { api_key: 'sk_test_abc' })
    await expect((p as any).handleAction('unknown', {})).rejects.toThrow('Stripe: unknown action')
  })
})

// ─── HubSpot ───────────────────────────────────────────────────
describe('HubSpotProvider', () => {
  it('constructs with API key', () => {
    const p = makeProvider(HubSpotProvider, { api_key: 'hs-key' })
    expect(p).toBeInstanceOf(HubSpotProvider)
  })

  it('throws on missing key', async () => {
    const p = makeProvider(HubSpotProvider, {})
    await expect((p as any).handleAction('create_contact', {})).rejects.toThrow('HubSpot: no API key')
  })

  it('calls create_contact', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ id: '1001', properties: { email: 'a@b.com' } }))
    const p = makeProvider(HubSpotProvider, { api_key: 'hs-key' })
    const result = await (p as any).handleAction('create_contact', { email: 'a@b.com', firstName: 'A', lastName: 'B' })
    expect(result.id).toBe('1001')
    expect(fetch).toHaveBeenCalledWith('https://api.hubapi.com/crm/v3/objects/contacts', expect.objectContaining({ method: 'POST' }))
  })

  it('calls update_contact', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({}))
    const p = makeProvider(HubSpotProvider, { api_key: 'hs-key' })
    const result = await (p as any).handleAction('update_contact', { contactId: '1001', email: 'new@b.com' })
    expect(result.id).toBe('1001')
    expect(result.status).toBe('updated')
  })

  it('calls sync_contacts', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({}))
    const p = makeProvider(HubSpotProvider, { api_key: 'hs-key' })
    const result = await (p as any).handleAction('sync_contacts', { ids: ['1001'] })
    expect(result.synced).toBe(1)
  })

  it('searches contacts', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ results: [{ id: '1', properties: { email: 'a@b.com', firstname: 'A' } }], total: 1 }))
    const p = makeProvider(HubSpotProvider, { api_key: 'hs-key' })
    const result = await (p as any).handleAction('search_contacts', { query: 'test', limit: 5 })
    expect(result.total).toBe(1)
    expect(result.contacts[0].email).toBe('a@b.com')
  })
})

// ─── Calendly ──────────────────────────────────────────────────
describe('CalendlyProvider', () => {
  it('constructs with access token', () => {
    const p = makeProvider(CalendlyProvider, { access_token: 'cal-token' })
    expect(p).toBeInstanceOf(CalendlyProvider)
  })

  it('throws on missing token', async () => {
    const p = makeProvider(CalendlyProvider, {})
    await expect((p as any).handleAction('get_user', {})).rejects.toThrow('Calendly: no access token')
  })

  it('calls get_user', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ resource: { uri: 'https://api.calendly.com/users/u1', name: 'Test', email: 'a@b.com', slug: 'test' } }))
    const p = makeProvider(CalendlyProvider, { access_token: 'cal-token' })
    const result = await (p as any).handleAction('get_user', {})
    expect(result.name).toBe('Test')
  })

  it('calls create_event', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ resource: { uri: 'https://api.calendly.com/scheduled_events/e1', start_time: '2025-01-01T10:00:00Z' } }))
    const p = makeProvider(CalendlyProvider, { access_token: 'cal-token' })
    const result = await (p as any).handleAction('create_event', { name: 'Meeting', email: 'a@b.com', startTime: '2025-01-01T10:00:00Z' })
    expect(result.eventUri).toContain('e1')
  })

  it('calls cancel_event', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ resource: { canceled_by: 'test' } }))
    const p = makeProvider(CalendlyProvider, { access_token: 'cal-token' })
    const result = await (p as any).handleAction('cancel_event', { eventUri: 'https://api.calendly.com/scheduled_events/e1' })
    expect(result.status).toBe('canceled')
  })

  it('calls get_availability', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ collection: [{ schedule: 'default' }] }))
    const p = makeProvider(CalendlyProvider, { access_token: 'cal-token', user_uri: 'user_uri' })
    const result = await (p as any).handleAction('get_availability', {})
    expect(result.schedules).toHaveLength(1)
  })
})

// ─── Salesforce ─────────────────────────────────────────────────
describe('SalesforceProvider', () => {
  it('constructs with access token', () => {
    const p = makeProvider(SalesforceProvider, { access_token: 'sf-token', instance_url: 'https://na1.salesforce.com' })
    expect(p).toBeInstanceOf(SalesforceProvider)
  })

  it('fails on missing credentials', async () => {
    const p = makeProvider(SalesforceProvider, {})
    await expect((p as any).handleAction('query', {})).rejects.toThrow('Salesforce: no valid credentials')
  })

  it('calls query with SOQL', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ totalSize: 1, records: [{ Id: '001', Name: 'Acme' }], done: true }))
    const p = makeProvider(SalesforceProvider, { access_token: 'sf-token', instance_url: 'https://na1.salesforce.com' })
    const result = await (p as any).handleAction('query', { query: 'SELECT Id FROM Account' })
    expect(result.total).toBe(1)
  })

  it('creates a lead', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ id: '00QABC', success: true }))
    const p = makeProvider(SalesforceProvider, { access_token: 'sf-token', instance_url: 'https://na1.salesforce.com' })
    const result = await (p as any).handleAction('create_lead', { lastName: 'Test', company: 'Acme', email: 'test@acme.com' })
    expect(result.id).toBe('00QABC')
  })

  it('creates a contact', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ id: '003ABC', success: true }))
    const p = makeProvider(SalesforceProvider, { access_token: 'sf-token', instance_url: 'https://na1.salesforce.com' })
    const result = await (p as any).handleAction('create_contact', { firstName: 'John', lastName: 'Doe', email: 'john@acme.com' })
    expect(result.id).toBe('003ABC')
  })

  it('creates an opportunity', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ id: '006ABC', success: true }))
    const p = makeProvider(SalesforceProvider, { access_token: 'sf-token', instance_url: 'https://na1.salesforce.com' })
    const result = await (p as any).handleAction('create_opportunity', { name: 'Big Deal', amount: 50000 })
    expect(result.id).toBe('006ABC')
  })

  it('updates a record', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(null, 204))
    const p = makeProvider(SalesforceProvider, { access_token: 'sf-token', instance_url: 'https://na1.salesforce.com' })
    const result = await (p as any).handleAction('update_record', { sobject: 'Lead', id: '00QABC', Status: 'Contacted' })
    expect(result.status).toBe('updated')
  })

  it('describes an object', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({
      name: 'Lead', label: 'Lead',
      fields: [{ name: 'FirstName', label: 'First Name', type: 'string', nillable: false, defaultedOnCreate: false }],
    }))
    const p = makeProvider(SalesforceProvider, { access_token: 'sf-token', instance_url: 'https://na1.salesforce.com' })
    const result = await (p as any).handleAction('describe_object', { sobject: 'Lead' })
    expect(result.name).toBe('Lead')
    expect(result.fields).toHaveLength(1)
  })
})

// ─── Slack ─────────────────────────────────────────────────────
describe('SlackProvider', () => {
  it('constructs with bot token', () => {
    const p = makeProvider(SlackProvider, { api_key: 'xoxb-test' })
    expect(p).toBeInstanceOf(SlackProvider)
  })

  it('throws on missing token', async () => {
    const p = makeProvider(SlackProvider, {})
    await expect((p as any).handleAction('send_message', {})).rejects.toThrow('Slack: no bot token')
  })

  it('sends a message', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: true, channel: 'C123', ts: '1700000000.001' }))
    const p = makeProvider(SlackProvider, { api_key: 'xoxb-test' })
    const result = await (p as any).handleAction('send_message', { channel: '#general', text: 'Hello' })
    expect(result.channel).toBe('C123')
    expect(fetch).toHaveBeenCalledWith('https://slack.com/api/chat.postMessage', expect.any(Object))
  })
})

// ─── Discord ───────────────────────────────────────────────────
describe('DiscordProvider', () => {
  it('constructs with bot token', () => {
    const p = makeProvider(DiscordProvider, { bot_token: 'discord-token' })
    expect(p).toBeInstanceOf(DiscordProvider)
  })

  it('throws on missing token', async () => {
    const p = makeProvider(DiscordProvider, {})
    await expect((p as any).handleAction('send_message', { channelId: 'ch1', text: 'Hello' })).rejects.toThrow('Discord: no bot token')
  })

  it('sends a message', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ id: 'msg1', channel_id: 'ch1' }))
    const p = makeProvider(DiscordProvider, { bot_token: 'discord-token' })
    const result = await (p as any).handleAction('send_message', { channelId: 'ch1', text: 'Hello' })
    expect(result.messageId).toBe('msg1')
    expect(fetch).toHaveBeenCalledWith('https://discord.com/api/v10/channels/ch1/messages', expect.objectContaining({ method: 'POST' }))
  })
})

// ─── Telegram ──────────────────────────────────────────────────
describe('TelegramProvider', () => {
  it('constructs with bot token', () => {
    const p = makeProvider(TelegramProvider, { api_key: 'tg-token' })
    expect(p).toBeInstanceOf(TelegramProvider)
  })

  it('throws on missing token', async () => {
    const p = makeProvider(TelegramProvider, {})
    await expect((p as any).handleAction('send_message', { chatId: '-100123', text: 'Hello' })).rejects.toThrow('Telegram: no bot token')
  })

  it('sends a message', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ ok: true, result: { message_id: 1, chat: { id: -100123 } } }))
    const p = makeProvider(TelegramProvider, { api_key: 'tg-token' })
    const result = await (p as any).handleAction('send_message', { chatId: '-100123', text: 'Hello' })
    expect(result.messageId).toBe(1)
    expect(result.status).toBe('sent')
    expect(fetch).toHaveBeenCalledWith('https://api.telegram.org/bottg-token/sendMessage', expect.any(Object))
  })
})

// ─── Airtable ──────────────────────────────────────────────────
describe('AirtableProvider', () => {
  it('constructs with API key', () => {
    const p = makeProvider(AirtableProvider, { api_key: 'airtable-key' })
    expect(p).toBeInstanceOf(AirtableProvider)
  })

  it('throws on missing key', async () => {
    const p = makeProvider(AirtableProvider, {})
    await expect((p as any).handleAction('list_records', { baseId: 'app1', table: 'Table1' })).rejects.toThrow('Airtable: no API key')
  })

  it('lists records', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ records: [{ id: 'rec1', fields: { Name: 'Test' } }] }))
    const p = makeProvider(AirtableProvider, { api_key: 'airtable-key' })
    const result = await (p as any).handleAction('list_records', { baseId: 'app1', table: 'Table1' })
    expect(result.records[0].fields.Name).toBe('Test')
  })

  it('creates a record', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ records: [{ id: 'rec_new', fields: { Name: 'New' } }] }))
    const p = makeProvider(AirtableProvider, { api_key: 'airtable-key' })
    const result = await (p as any).handleAction('create_record', { baseId: 'app1', table: 'Table1', fields: { Name: 'New' } })
    expect(result.records[0].id).toBe('rec_new')
    expect(result.status).toBe('created')
  })

  it('gets a record', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ id: 'rec1', fields: { Name: 'Test' } }))
    const p = makeProvider(AirtableProvider, { api_key: 'airtable-key' })
    const result = await (p as any).handleAction('get_record', { baseId: 'app1', table: 'Table1', recordId: 'rec1' })
    expect(result.id).toBe('rec1')
  })
})

// ─── n8n ───────────────────────────────────────────────────────
describe('N8nProvider', () => {
  it('constructs with API key', () => {
    const p = makeProvider(N8nProvider, { api_key: 'n8n-key' })
    expect(p).toBeInstanceOf(N8nProvider)
  })

  it('lists workflows', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ data: [{ id: '1', name: 'Test Workflow', active: true }] }))
    const p = makeProvider(N8nProvider, { api_key: 'n8n-key' })
    const result = await (p as any).handleAction('list_workflows', {})
    expect(result.workflows[0].name).toBe('Test Workflow')
  })

  it('triggers a workflow', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({}))
    const p = makeProvider(N8nProvider, { api_key: 'n8n-key' })
    const result = await (p as any).handleAction('trigger_workflow', { workflowId: '1', payload: { input: 'test' } })
    expect(result.status).toBe('triggered')
  })

  it('activates a workflow', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({}))
    const p = makeProvider(N8nProvider, { api_key: 'n8n-key' })
    const result = await (p as any).handleAction('activate_workflow', { workflowId: '1' })
    expect(result.status).toBe('activated')
  })
})

// ─── make.com ──────────────────────────────────────────────────
describe('MakeProvider', () => {
  it('constructs with API key', () => {
    const p = makeProvider(MakeProvider, { api_key: 'make-key' })
    expect(p).toBeInstanceOf(MakeProvider)
  })

  it('lists scenarios (requires team_id)', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ scenarios: [{ id: 1, name: 'Test Scenario', isActive: true }] }))
    const p = makeProvider(MakeProvider, { api_key: 'make-key', team_id: 'team1' })
    const result = await (p as any).handleAction('list_scenarios', {})
    expect(result.scenarios[0].name).toBe('Test Scenario')
  })

  it('triggers a scenario', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ execution: { id: 'exec_1', startedAt: '2025-01-01T00:00:00Z' } }))
    const p = makeProvider(MakeProvider, { api_key: 'make-key', team_id: 'team1' })
    const result = await (p as any).handleAction('trigger_scenario', { scenarioId: 1, data: { input: 'test' } })
    expect(result.executionId).toBe('exec_1')
  })

  it('gets executions', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ executions: [{ id: 'e1', status: 'success', startedAt: '2025-01-01T00:00:00Z', finishedAt: '2025-01-01T01:00:00Z' }] }))
    const p = makeProvider(MakeProvider, { api_key: 'make-key', team_id: 'team1' })
    const result = await (p as any).handleAction('get_executions', { scenarioId: 1 })
    expect(result.executions).toHaveLength(1)
  })
})

// ─── Paddle ──────────────────────────────────────────────────
describe('PaddleProvider', () => {
  it('constructs with API key', () => {
    const p = makeProvider(PaddleProvider, { api_key: 'pdl_key_abc' })
    expect(p).toBeInstanceOf(PaddleProvider)
  })

  it('throws on missing API key for actions', async () => {
    const p = makeProvider(PaddleProvider, {})
    await expect((p as any).handleAction('create_transaction', { items: [] })).rejects.toThrow('Paddle: no API key')
  })

  it('creates a transaction', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ data: { id: 'txn_123', status: 'draft', details: { totals: { total: '1000' } }, currency_code: 'USD', checkout: { url: 'https://checkout.paddle.com/123' }, created_at: '2026-01-01T00:00:00Z' } }))
    const p = makeProvider(PaddleProvider, { api_key: 'pdl_key_abc' })
    const result = await (p as any).handleAction('create_transaction', { items: [{ priceId: 'pri_123' }], currency: 'USD' })
    expect(result.transactionId).toBe('txn_123')
    expect(result.checkoutUrl).toContain('checkout.paddle.com')
  })

  it('lists transactions', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ data: [{ id: 'txn_1', status: 'completed', details: { totals: { total: '5000' } }, currency_code: 'USD', created_at: '2026-01-01T00:00:00Z' }], meta: { total: 1 } }))
    const p = makeProvider(PaddleProvider, { api_key: 'pdl_key_abc' })
    const result = await (p as any).handleAction('list_transactions', { status: 'completed' })
    expect(result.transactions).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('creates a customer', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ data: { id: 'cus_123', email: 'test@example.com', name: 'Test' } }))
    const p = makeProvider(PaddleProvider, { api_key: 'pdl_key_abc' })
    const result = await (p as any).handleAction('create_customer', { email: 'test@example.com', name: 'Test' })
    expect(result.customerId).toBe('cus_123')
  })

  it('lists products', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ data: [{ id: 'pro_1', name: 'Growth Plan', type: 'standard', status: 'active', tax_category: 'standard', created_at: '2026-01-01T00:00:00Z' }], meta: { total: 1 } }))
    const p = makeProvider(PaddleProvider, { api_key: 'pdl_key_abc' })
    const result = await (p as any).handleAction('list_products', { status: 'active' })
    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('Growth Plan')
  })

  it('gets a product', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ data: { id: 'pro_1', name: 'Starter Plan', type: 'standard', status: 'active', tax_category: 'digital', description: 'Basic plan', created_at: '2026-01-01T00:00:00Z' } }))
    const p = makeProvider(PaddleProvider, { api_key: 'pdl_key_abc' })
    const result = await (p as any).handleAction('get_product', { productId: 'pro_1' })
    expect(result.id).toBe('pro_1')
  })

  it('creates a subscription', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ data: { id: 'sub_123', status: 'active', next_billed_at: '2026-02-01T00:00:00Z', currency_code: 'USD', created_at: '2026-01-01T00:00:00Z' } }))
    const p = makeProvider(PaddleProvider, { api_key: 'pdl_key_abc' })
    const result = await (p as any).handleAction('create_subscription', { customerId: 'cus_123', items: [{ priceId: 'pri_monthly' }] })
    expect(result.subscriptionId).toBe('sub_123')
    expect(result.status).toBe('active')
  })

  it('throws on unknown action', async () => {
    const p = makeProvider(PaddleProvider, { api_key: 'pdl_key_abc' })
    await expect((p as any).handleAction('unknown', {})).rejects.toThrow('Paddle: unknown action')
  })
})

// ─── Resend ──────────────────────────────────────────────────
describe('ResendProvider', () => {
  it('constructs with API key', () => {
    const p = makeProvider(ResendProvider, { api_key: 're_abc' })
    expect(p).toBeInstanceOf(ResendProvider)
  })

  it('throws on missing API key', async () => {
    const p = makeProvider(ResendProvider, {})
    await expect((p as any).handleAction('send_email', {})).rejects.toThrow('Resend: no API key')
  })

  it('sends an email', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ id: 'email_123' }))
    const p = makeProvider(ResendProvider, { api_key: 're_abc' })
    const result = await (p as any).handleAction('send_email', { to: 'test@example.com', subject: 'Test', text: 'Hello' })
    expect(result.messageId).toBe('email_123')
    expect(result.status).toBe('sent')
  })

  it('gets an email', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ id: 'email_123', subject: 'Test', to: ['test@example.com'] }))
    const p = makeProvider(ResendProvider, { api_key: 're_abc' })
    const result = await (p as any).handleAction('get_email', { emailId: 'email_123' })
    expect(result.id).toBe('email_123')
  })

  it('lists audiences', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ data: [{ id: 'aud_1', name: 'Newsletter' }] }))
    const p = makeProvider(ResendProvider, { api_key: 're_abc' })
    const result = await (p as any).handleAction('list_audiences', {})
    expect(result.audiences).toHaveLength(1)
  })

  it('creates a contact in audience', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ id: 'contact_123' }))
    const p = makeProvider(ResendProvider, { api_key: 're_abc' })
    const result = await (p as any).handleAction('create_contact', { email: 'user@test.com', firstName: 'Test', audienceId: 'aud_1' })
    expect(result.contactId).toBe('contact_123')
  })

  it('throws on unknown action', async () => {
    const p = makeProvider(ResendProvider, { api_key: 're_abc' })
    await expect((p as any).handleAction('unknown', {})).rejects.toThrow('Resend: unknown action')
  })
})
