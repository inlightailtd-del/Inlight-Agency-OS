import { BaseProvider } from './provider'

function base64url(data: string): string {
  return Buffer.from(data).toString('base64url')
}

// ─── Stripe (Real REST API) ───────────────────────────────
export class StripeProvider extends BaseProvider {
  private get apiKey(): string {
    return this.credentials?.api_key || this.credentials?.secret_key || ''
  }

  private async stripeFetch(path: string, opts?: RequestInit): Promise<any> {
    const key = this.apiKey
    if (!key) throw new Error('Stripe: no API key configured')
    const r = await fetch(`https://api.stripe.com/v1${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...opts?.headers,
      },
    })
    const body = await r.json()
    if (!r.ok) throw new Error(`Stripe API error: ${body.error?.message ?? r.status}`)
    return body
  }

  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'create_payment': {
        const body = new URLSearchParams({
          amount: String(Math.round(params.amount * 100)),
          currency: params.currency || 'usd',
          payment_method_types: ['card'].join(','),
          confirmation_method: 'manual',
        })
        if (params.description) body.set('description', params.description)
        if (params.customer) body.set('customer', params.customer)
        if (params.metadata) body.set('metadata', JSON.stringify(params.metadata))
        const pi = await this.stripeFetch('/payment_intents', { method: 'POST', body: body.toString() })
        return { paymentIntent: pi.id, amount: pi.amount / 100, currency: pi.currency, status: pi.status, clientSecret: pi.client_secret }
      }
      case 'create_invoice': {
        const body = new URLSearchParams({ collection_method: 'send_invoice', days_until_due: '30' })
        if (params.customer) body.set('customer', params.customer)
        if (params.description) body.set('description', params.description)
        if (params.auto_advance) body.set('auto_advance', 'true')
        const inv = await this.stripeFetch('/invoices', { method: 'POST', body: body.toString() })
        if (params.items) {
          for (const item of params.items) {
            const ib = new URLSearchParams({
              customer: inv.customer,
              currency: 'usd',
              description: item.description || 'Service',
            })
            if (item.amount) ib.set('amount', String(Math.round(item.amount * 100)))
            if (item.quantity) ib.set('quantity', String(item.quantity))
            await this.stripeFetch('/invoice_items', { method: 'POST', body: ib.toString() })
          }
          await this.stripeFetch(`/invoices/${inv.id}/finalize`, { method: 'POST' })
          const finalized = await this.stripeFetch(`/invoices/${inv.id}`)
          return { invoiceId: finalized.id, amount: finalized.total / 100, status: finalized.status, hostedUrl: finalized.hosted_invoice_url, pdfUrl: finalized.invoice_pdf }
        }
        return { invoiceId: inv.id, amount: 0, status: inv.status }
      }
      case 'get_balance': {
        const bal = await this.stripeFetch('/balance')
        const available = bal.available?.reduce((s: number, b: any) => s + b.amount, 0) ?? 0
        const pending = bal.pending?.reduce((s: number, b: any) => s + b.amount, 0) ?? 0
        return { balance: available / 100, currency: 'usd', pending: pending / 100, sources: bal.available }
      }
      case 'create_customer': {
        const body = new URLSearchParams()
        if (params.email) body.set('email', params.email)
        if (params.name) body.set('name', params.name)
        if (params.description) body.set('description', params.description)
        if (params.phone) body.set('phone', params.phone)
        if (params.metadata) body.set('metadata', JSON.stringify(params.metadata))
        const customer = await this.stripeFetch('/customers', { method: 'POST', body: body.toString() })
        return { customerId: customer.id, email: customer.email, name: customer.name }
      }
      case 'list_invoices': {
        const query = params.customer ? `?customer=${params.customer}` : '?limit=10'
        const invs = await this.stripeFetch(`/invoices${query}`)
        return { invoices: invs.data?.map((i: any) => ({ id: i.id, amount: i.total / 100, status: i.status, created: new Date(i.created * 1000).toISOString() })) ?? [], total: invs.data?.length ?? 0 }
      }
      default:
        throw new Error(`Stripe: unknown action ${action}`)
    }
  }
}

// ─── HubSpot (Real REST API) ──────────────────────────────
export class HubSpotProvider extends BaseProvider {
  private get apiKey(): string {
    return this.credentials?.api_key || this.credentials?.access_token || ''
  }

  private async hsFetch(path: string, opts?: RequestInit): Promise<any> {
    const key = this.apiKey
    if (!key) throw new Error('HubSpot: no API key or access token configured')
    const r = await fetch(`https://api.hubapi.com${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...opts?.headers,
      },
    })
    if (!r.ok) {
      const err = await r.text()
      throw new Error(`HubSpot API error: ${r.status} ${err}`)
    }
    return r.json()
  }

  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'create_contact': {
        const props: Record<string, string> = {}
        if (params.email) props.email = params.email
        if (params.firstName) props.firstname = params.firstName
        if (params.lastName) props.lastname = params.lastName
        if (params.phone) props.phone = params.phone
        if (params.company) props.company = params.company
        if (params.jobTitle) props.jobtitle = params.jobTitle
        if (params.website) props.website = params.website
        const r = await this.hsFetch('/crm/v3/objects/contacts', {
          method: 'POST',
          body: JSON.stringify({ properties: props }),
        })
        return { id: r.id, email: r.properties?.email, status: 'created' }
      }
      case 'update_contact': {
        const props: Record<string, string> = {}
        if (params.email) props.email = params.email
        if (params.firstName) props.firstname = params.firstName
        if (params.lastName) props.lastname = params.lastName
        if (params.phone) props.phone = params.phone
        if (params.company) props.company = params.company
        const id = params.contactId || params.id
        if (!id) throw new Error('HubSpot: contactId required for update')
        await this.hsFetch(`/crm/v3/objects/contacts/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ properties: props }),
        })
        return { id, status: 'updated' }
      }
      case 'create_deal': {
        const props: Record<string, any> = {}
        if (params.value) props.amount = String(params.value)
        if (params.stage) props.dealstage = params.stage
        if (params.name) props.dealname = params.name
        if (params.pipeline) props.pipeline = params.pipeline
        props.dealname = props.dealname || `Deal - ${params.name || Date.now()}`
        const r = await this.hsFetch('/crm/v3/objects/deals', {
          method: 'POST',
          body: JSON.stringify({ properties: props }),
        })
        const result: any = { id: r.id, value: params.value, stage: params.stage }
        if (params.contactId) {
          await this.hsFetch(`/crm/v3/objects/deals/${r.id}/associations/contacts/${params.contactId}/1`, {
            method: 'PUT',
          })
          result.contactId = params.contactId
        }
        return result
      }
      case 'sync_contacts': {
        const ids = params.ids || []
        let synced = 0
        for (const id of ids) {
          try {
            await this.hsFetch(`/crm/v3/objects/contacts/${id}`, { method: 'GET' })
            synced++
          } catch { /* skip */ }
        }
        return { synced, total: ids.length }
      }
      case 'search_contacts': {
        const query = params.query || ''
        const limit = params.limit || 10
        const r = await this.hsFetch(`/crm/v3/objects/contacts/search`, {
          method: 'POST',
          body: JSON.stringify({
            query,
            limit,
            properties: ['email', 'firstname', 'lastname', 'phone', 'company', 'createdate'],
          }),
        })
        return {
          contacts: r.results?.map((c: any) => ({
            id: c.id, email: c.properties?.email, firstName: c.properties?.firstname,
            lastName: c.properties?.lastname, phone: c.properties?.phone,
            company: c.properties?.company, createdAt: c.properties?.createdate,
          })) ?? [],
          total: r.total ?? 0,
        }
      }
      case 'list_deals': {
        const limit = params.limit || 10
        const r = await this.hsFetch(`/crm/v3/objects/deals?limit=${limit}&properties=dealname,amount,dealstage,pipeline,createdate`)
        return {
          deals: r.results?.map((d: any) => ({
            id: d.id, name: d.properties?.dealname, amount: d.properties?.amount,
            stage: d.properties?.dealstage, pipeline: d.properties?.pipeline,
            createdAt: d.properties?.createdate,
          })) ?? [],
          total: r.total ?? 0,
        }
      }
      default:
        throw new Error(`HubSpot: unknown action ${action}`)
    }
  }
}

// ─── Calendly (Real REST API) ─────────────────────────────
export class CalendlyProvider extends BaseProvider {
  private get token(): string {
    return this.credentials?.access_token || ''
  }

  private async calFetch(path: string, opts?: RequestInit): Promise<any> {
    const t = this.token
    if (!t) throw new Error('Calendly: no access token configured')
    const r = await fetch(`https://api.calendly.com${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${t}`,
        'Content-Type': 'application/json',
        ...opts?.headers,
      },
    })
    if (!r.ok) {
      const err = await r.text()
      throw new Error(`Calendly API error: ${r.status} ${err}`)
    }
    return r.json()
  }

  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'get_user': {
        const r = await this.calFetch('/users/me')
        return { uri: r.resource?.uri, name: r.resource?.name, email: r.resource?.email, slug: r.resource?.slug }
      }
      case 'create_event': {
        const body: Record<string, any> = {
          max_event_count: 1,
          invitees_counter: { limit: 1 },
        }
        if (params.name) body.name = params.name
        if (params.description) body.description = params.description
        if (params.startTime || params.time) {
          body.start_time = params.startTime || params.time
          body.end_time = params.endTime || new Date(new Date(params.startTime || params.time).getTime() + 3600000).toISOString()
        }
        if (params.email) body.invitees = [{ email: params.email, name: params.name || params.email }]
        if (params.eventType) body.event_type = params.eventType
        if (params.location) body.location = params.location
        if (params.questions) body.questions_and_answers = params.questions
        const r = await this.calFetch('/scheduled_events', { method: 'POST', body: JSON.stringify(body) })
        return { eventUri: r.resource?.uri, status: 'scheduled', invitee: params.email, startTime: r.resource?.start_time }
      }
      case 'get_events': {
        const count = params.count || 20
        const r = await this.calFetch(`/scheduled_events?count=${count}&organization=${encodeURIComponent(this.credentials?.organization_uri || '')}&user=${encodeURIComponent(this.credentials?.user_uri || '')}`)
        return { events: r.collection?.map((e: any) => ({ uri: e.uri, name: e.name, startTime: e.start_time, endTime: e.end_time, status: e.status })) ?? [], total: r.collection?.length ?? 0 }
      }
      case 'cancel_event': {
        const uri = params.eventUri || params.event
        if (!uri) throw new Error('Calendly: eventUri required')
        const body: Record<string, any> = { reason: params.reason || 'Cancelled via API' }
        const r = await this.calFetch(`/scheduled_events/${uri.split('/').pop()}/cancellation`, { method: 'POST', body: JSON.stringify(body) })
        return { eventUri: uri, status: 'canceled', canceledBy: r.resource?.canceled_by }
      }
      case 'get_event_types': {
        const r = await this.calFetch(`/event_types?user=${encodeURIComponent(this.credentials?.user_uri || '')}`)
        return { eventTypes: r.collection?.map((et: any) => ({ uri: et.uri, name: et.name, slug: et.slug, duration: et.duration_minutes, type: et.type })) ?? [] }
      }
      case 'get_availability': {
        const uri = params.userUri || this.credentials?.user_uri
        if (!uri) throw new Error('Calendly: userUri required')
        const start = params.startDate || new Date().toISOString()
        const end = params.endDate || new Date(Date.now() + 7 * 86400000).toISOString()
        const r = await this.calFetch(`/user_availability_schedules?user=${encodeURIComponent(uri)}`)
        return { schedules: r.collection ?? [] }
      }
      default:
        throw new Error(`Calendly: unknown action ${action}`)
    }
  }
}

// ─── Salesforce (Real REST API) ───────────────────────────
export class SalesforceProvider extends BaseProvider {
  private instanceUrl = ''
  private accessToken = ''

  private async ensureAuth(): Promise<void> {
    this.accessToken = this.credentials?.access_token || ''
    this.instanceUrl = this.credentials?.instance_url || ''
    if (!this.accessToken || !this.instanceUrl) {
      // Try OAuth client credentials if available
      const clientId = this.credentials?.client_id || ''
      const clientSecret = this.credentials?.client_secret || ''
      const username = this.credentials?.username || ''
      const password = this.credentials?.password || ''
      const loginUrl = this.credentials?.login_url || 'https://login.salesforce.com'
      if (clientId && clientSecret && username && password) {
        const body = new URLSearchParams({
          grant_type: 'password',
          client_id: clientId,
          client_secret: clientSecret,
          username,
          password,
        })
        const r = await fetch(`${loginUrl}/services/oauth2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        })
        if (!r.ok) throw new Error(`Salesforce auth failed: ${r.status}`)
        const data = await r.json()
        this.accessToken = data.access_token
        this.instanceUrl = data.instance_url
        // Cache for future calls
        this.credentials.access_token = data.access_token
        this.credentials.instance_url = data.instance_url
      } else {
        throw new Error('Salesforce: no valid credentials (need access_token + instance_url or client credentials)')
      }
    }
  }

  private async sfFetch(path: string, opts?: RequestInit): Promise<any> {
    await this.ensureAuth()
    const r = await fetch(`${this.instanceUrl}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...opts?.headers,
      },
    })
    if (!r.ok) {
      const err = await r.text()
      throw new Error(`Salesforce API error: ${r.status} ${err}`)
    }
    if (r.headers.get('content-length') === '0' || r.status === 204) return null
    return r.json()
  }

  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    const apiVersion = 'v60.0'
    switch (action) {
      case 'create_lead': {
        const body: Record<string, string> = {}
        if (params.firstName) body.FirstName = params.firstName
        if (params.lastName) body.LastName = params.lastName || 'Lead'
        if (params.email) body.Email = params.email
        if (params.company) body.Company = params.company || 'Unknown'
        if (params.phone) body.Phone = params.phone
        if (params.title) body.Title = params.title
        if (params.description) body.Description = params.description
        if (params.status) body.Status = params.status
        if (params.source) body.LeadSource = params.source
        const r = await this.sfFetch(`/services/data/${apiVersion}/sobjects/Lead`, {
          method: 'POST',
          body: JSON.stringify(body),
        })
        return { id: r.id, status: 'created', url: `${this.instanceUrl}/${r.id}` }
      }
      case 'create_contact': {
        const body: Record<string, string> = {}
        if (params.firstName) body.FirstName = params.firstName
        if (params.lastName) body.LastName = params.lastName || 'Contact'
        if (params.email) body.Email = params.email
        if (params.phone) body.Phone = params.phone
        if (params.accountId) body.AccountId = params.accountId
        if (params.title) body.Title = params.title
        if (params.description) body.Description = params.description
        const r = await this.sfFetch(`/services/data/${apiVersion}/sobjects/Contact`, {
          method: 'POST',
          body: JSON.stringify(body),
        })
        return { id: r.id, status: 'created' }
      }
      case 'create_opportunity': {
        const body: Record<string, any> = {
          Name: params.name || 'Opportunity',
          StageName: params.stage || 'Prospecting',
          CloseDate: params.closeDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        }
        if (params.amount) body.Amount = params.amount
        if (params.accountId) body.AccountId = params.accountId
        if (params.description) body.Description = params.description
        if (params.type) body.Type = params.type
        const r = await this.sfFetch(`/services/data/${apiVersion}/sobjects/Opportunity`, {
          method: 'POST',
          body: JSON.stringify(body),
        })
        return { id: r.id, status: 'created' }
      }
      case 'query': {
        const query = params.query || `SELECT Id, Name, Company, Email, Status FROM Lead LIMIT ${params.limit || 10}`
        const r = await this.sfFetch(`/services/data/${apiVersion}/query?q=${encodeURIComponent(query)}`)
        return { records: r.records ?? [], total: r.totalSize ?? 0, done: r.done }
      }
      case 'update_record': {
        const sobject = params.sobject || 'Lead'
        const id = params.id
        if (!id) throw new Error('Salesforce: id required for update_record')
        const fields: Record<string, any> = {}
        for (const [key, val] of Object.entries(params)) {
          if (!['sobject', 'id', 'action'].includes(key)) fields[key] = val
        }
        await this.sfFetch(`/services/data/${apiVersion}/sobjects/${sobject}/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(fields),
        })
        return { id, status: 'updated' }
      }
      case 'get_object': {
        const sobject = params.sobject || 'Lead'
        const id = params.id
        if (!id) throw new Error('Salesforce: id required for get_object')
        return this.sfFetch(`/services/data/${apiVersion}/sobjects/${sobject}/${id}`)
      }
      case 'describe_object': {
        const sobject = params.sobject || 'Lead'
        const desc = await this.sfFetch(`/services/data/${apiVersion}/sobjects/${sobject}/describe`)
        return {
          name: desc.name,
          label: desc.label,
          fields: desc.fields?.map((f: any) => ({ name: f.name, label: f.label, type: f.type, required: f.nillable === false && f.defaultedOnCreate === false })) ?? [],
        }
      }
      default:
        throw new Error(`Salesforce: unknown action ${action}`)
    }
  }
}

// ─── Slack (Real Web API) ─────────────────────────────────
export class SlackProvider extends BaseProvider {
  private get token(): string {
    return this.credentials?.bot_token || this.credentials?.access_token || this.credentials?.api_key || ''
  }

  private async slackFetch(method: string, body?: Record<string, any>): Promise<any> {
    const t = this.token
    if (!t) throw new Error('Slack: no bot token configured')
    const r = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${t}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await r.json()
    if (!data.ok) throw new Error(`Slack API error: ${data.error}`)
    return data
  }

  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'send_message': {
        const body: Record<string, any> = { channel: params.channel || params.channelId }
        if (params.text) body.text = params.text
        if (params.blocks) body.blocks = params.blocks
        if (params.threadTs) body.thread_ts = params.threadTs
        if (params.iconUrl) body.icon_url = params.iconUrl
        if (params.username) body.username = params.username
        if (params.parse) body.parse = params.parse
        if (params.linkNames) body.link_names = params.linkNames
        const r = await this.slackFetch('chat.postMessage', body)
        return { messageTs: r.ts, channel: r.channel, status: 'sent' }
      }
      case 'create_channel': {
        const body: Record<string, any> = { name: params.name }
        if (params.isPrivate !== undefined) body.is_private = params.isPrivate
        const r = await this.slackFetch('conversations.create', body)
        return { channelId: r.channel?.id, name: r.channel?.name, status: 'created' }
      }
      case 'list_channels': {
        const limit = params.limit || 100
        const types = params.types || 'public_channel,private_channel'
        const r = await this.slackFetch('conversations.list', { limit, types, exclude_archived: true })
        return {
          channels: r.channels?.map((c: any) => ({ id: c.id, name: c.name, topic: c.topic?.value, memberCount: c.num_members, isPrivate: c.is_private })) ?? [],
          total: r.channels?.length ?? 0,
        }
      }
      case 'get_channel_history': {
        const channel = params.channel || params.channelId
        const limit = params.limit || 20
        if (!channel) throw new Error('Slack: channel required')
        const r = await this.slackFetch('conversations.history', { channel, limit })
        return {
          messages: r.messages?.map((m: any) => ({ ts: m.ts, user: m.user, text: m.text, type: m.type, threadTs: m.thread_ts })) ?? [],
          hasMore: r.has_more,
        }
      }
      case 'add_reaction': {
        const body: Record<string, any> = {
          channel: params.channel || params.channelId,
          name: params.reaction || params.name,
        }
        if (params.timestamp) body.timestamp = params.timestamp
        await this.slackFetch('reactions.add', body)
        return { status: 'added', reaction: params.reaction }
      }
      case 'upload_file': {
        const body = new FormData()
        body.append('channels', params.channel || params.channelId || '')
        if (params.fileContent) {
          const blob = new Blob([params.fileContent], { type: params.fileType || 'text/plain' })
          body.append('file', blob, params.filename || 'file.txt')
        }
        if (params.title) body.append('title', params.title)
        if (params.initialComment) body.append('initial_comment', params.initialComment)
        body.append('token', this.token)
        const r = await fetch('https://slack.com/api/files.upload', { method: 'POST', body })
        const data = await r.json()
        if (!data.ok) throw new Error(`Slack upload error: ${data.error}`)
        return { fileId: data.file?.id, permalink: data.file?.permalink, status: 'uploaded' }
      }
      case 'get_user_info': {
        const user = params.user || params.userId
        if (!user) throw new Error('Slack: user required')
        const r = await this.slackFetch('users.info', { user })
        return {
          userId: r.user?.id, name: r.user?.name, realName: r.user?.real_name, email: r.user?.profile?.email,
          displayName: r.user?.profile?.display_name, avatarUrl: r.user?.profile?.image_512,
        }
      }
      default:
        throw new Error(`Slack: unknown action ${action}`)
    }
  }
}

// ─── Discord (Real REST API) ──────────────────────────────
export class DiscordProvider extends BaseProvider {
  private get token(): string {
    return this.credentials?.bot_token || this.credentials?.access_token || ''
  }

  private async discordFetch(path: string, opts?: RequestInit): Promise<any> {
    const t = this.token
    if (!t) throw new Error('Discord: no bot token configured')
    const r = await fetch(`https://discord.com/api/v10${path}`, {
      ...opts,
      headers: {
        Authorization: `Bot ${t}`,
        'Content-Type': 'application/json',
        'User-Agent': 'InlightAgencyOS/1.0',
        ...opts?.headers,
      },
    })
    if (!r.ok) {
      const err = await r.text()
      throw new Error(`Discord API error: ${r.status} ${err}`)
    }
    if (r.status === 204 || r.headers.get('content-length') === '0') return null
    return r.json()
  }

  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'send_message': {
        const body: Record<string, any> = { content: params.content || params.text || '' }
        if (params.embeds) body.embeds = params.embeds
        if (params.tts) body.tts = params.tts
        if (params.components) body.components = params.components
        if (params.attachments) body.attachments = params.attachments
        const channelId = params.channel || params.channelId
        if (!channelId) throw new Error('Discord: channel id required')
        const r = await this.discordFetch(`/channels/${channelId}/messages`, {
          method: 'POST',
          body: JSON.stringify(body),
        })
        return { messageId: r.id, channelId, timestamp: r.timestamp, status: 'sent' }
      }
      case 'get_messages': {
        const channelId = params.channel || params.channelId
        const limit = params.limit || 20
        if (!channelId) throw new Error('Discord: channel id required')
        const r = await this.discordFetch(`/channels/${channelId}/messages?limit=${limit}`)
        return {
          messages: (r ?? []).map((m: any) => ({
            id: m.id, content: m.content, author: m.author?.username, timestamp: m.timestamp,
            embeds: m.embeds, attachments: m.attachments,
          })),
        }
      }
      case 'create_channel': {
        const guildId = params.guild || params.server || params.guildId
        if (!guildId) throw new Error('Discord: guild/server id required')
        const body: Record<string, any> = {
          name: params.name,
          type: params.type ?? 0,
          topic: params.topic || '',
        }
        if (params.parentId) body.parent_id = params.parentId
        if (params.nsfw) body.nsfw = params.nsfw
        if (params.permissionOverwrites) body.permission_overwrites = params.permissionOverwrites
        const r = await this.discordFetch(`/guilds/${guildId}/channels`, {
          method: 'POST',
          body: JSON.stringify(body),
        })
        return { channelId: r.id, name: r.name, type: r.type, status: 'created' }
      }
      case 'list_channels': {
        const guildId = params.guild || params.server || params.guildId
        if (!guildId) throw new Error('Discord: guild/server id required')
        const r = await this.discordFetch(`/guilds/${guildId}/channels`)
        return {
          channels: (r ?? []).map((c: any) => ({
            id: c.id, name: c.name, type: c.type, position: c.position,
            parentId: c.parent_id, nsfw: c.nsfw,
          })),
        }
      }
      case 'get_guild_info': {
        const guildId = params.guild || params.server || params.guildId
        if (!guildId) throw new Error('Discord: guild/server id required')
        const r = await this.discordFetch(`/guilds/${guildId}?with_counts=true`)
        return {
          id: r.id, name: r.name, description: r.description, memberCount: r.approximate_member_count,
          ownerId: r.owner_id, iconUrl: r.icon ? `https://cdn.discordapp.com/icons/${r.id}/${r.icon}.png` : null,
        }
      }
      case 'add_role': {
        const guildId = params.guild || params.guildId
        const userId = params.user || params.userId
        const roleId = params.role || params.roleId
        if (!guildId || !userId || !roleId) throw new Error('Discord: guild, user, and role required')
        await this.discordFetch(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, { method: 'PUT' })
        return { userId, roleId, status: 'added' }
      }
      case 'send_embed': {
        const channelId = params.channel || params.channelId
        if (!channelId) throw new Error('Discord: channel id required')
        const embed: Record<string, any> = {
          title: params.title || '',
          description: params.description || '',
          color: params.color || 5814783,
        }
        if (params.fields) embed.fields = params.fields
        if (params.footer) embed.footer = { text: params.footer }
        if (params.image) embed.image = { url: params.image }
        if (params.thumbnail) embed.thumbnail = { url: params.thumbnail }
        if (params.url) embed.url = params.url
        if (params.author) embed.author = { name: params.author }
        const r = await this.discordFetch(`/channels/${channelId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ embeds: [embed] }),
        })
        return { messageId: r.id, channelId, status: 'sent' }
      }
      default:
        throw new Error(`Discord: unknown action ${action}`)
    }
  }
}

// ─── Telegram (Real Bot API) ──────────────────────────────
export class TelegramProvider extends BaseProvider {
  private get botToken(): string {
    return this.credentials?.bot_token || this.credentials?.api_key || ''
  }

  private async tgFetch(method: string, body?: Record<string, any>): Promise<any> {
    const token = this.botToken
    if (!token) throw new Error('Telegram: no bot token configured')
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await r.json()
    if (!data.ok) throw new Error(`Telegram API error: ${data.description || r.status}`)
    return data
  }

  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'send_message': {
        const chatId = params.chat_id || params.chatId
        if (!chatId) throw new Error('Telegram: chat_id required')
        const body: Record<string, any> = {
          chat_id: chatId,
          text: params.text || params.message || '',
          parse_mode: params.parseMode || params.parse_mode || 'HTML',
        }
        if (params.disableWebPagePreview) body.disable_web_page_preview = params.disableWebPagePreview
        if (params.disableNotification) body.disable_notification = params.disableNotification
        if (params.replyToMessageId) body.reply_to_message_id = params.replyToMessageId
        if (params.replyMarkup) body.reply_markup = params.replyMarkup
        const r = await this.tgFetch('sendMessage', body)
        return { messageId: r.result?.message_id, chatId, status: 'sent', date: r.result?.date }
      }
      case 'send_photo': {
        const chatId = params.chat_id || params.chatId
        if (!chatId) throw new Error('Telegram: chat_id required')
        const body: Record<string, any> = { chat_id: chatId }
        if (params.photo) body.photo = params.photo
        if (params.caption) body.caption = params.caption
        if (params.parseMode) body.parse_mode = params.parseMode
        const r = await this.tgFetch('sendPhoto', body)
        return { messageId: r.result?.message_id, chatId, status: 'sent' }
      }
      case 'send_document': {
        const chatId = params.chat_id || params.chatId
        if (!chatId) throw new Error('Telegram: chat_id required')
        const body: Record<string, any> = { chat_id: chatId }
        if (params.document) body.document = params.document
        if (params.filename) body.filename = params.filename
        if (params.caption) body.caption = params.caption
        const r = await this.tgFetch('sendDocument', body)
        return { messageId: r.result?.message_id, chatId, status: 'sent' }
      }
      case 'get_updates': {
        const body: Record<string, any> = {}
        if (params.offset) body.offset = params.offset
        if (params.limit) body.limit = params.limit
        if (params.timeout) body.timeout = params.timeout
        const r = await this.tgFetch('getUpdates', body)
        return {
          updates: r.result?.map((u: any) => ({
            updateId: u.update_id, message: u.message, callbackQuery: u.callback_query,
          })) ?? [],
        }
      }
      case 'set_webhook': {
        const url = params.url
        if (!url) throw new Error('Telegram: webhook url required')
        const body: Record<string, any> = { url }
        if (params.secretToken) body.secret_token = params.secretToken
        if (params.allowedUpdates) body.allowed_updates = params.allowedUpdates
        const r = await this.tgFetch('setWebhook', body)
        return { status: r.result ? 'set' : 'failed', url }
      }
      case 'get_me': {
        const r = await this.tgFetch('getMe')
        return { botId: r.result?.id, username: r.result?.username, firstName: r.result?.first_name, canJoinGroups: r.result?.can_join_groups }
      }
      case 'create_invite_link': {
        const chatId = params.chat_id || params.chatId
        if (!chatId) throw new Error('Telegram: chat_id required')
        const body: Record<string, any> = { chat_id: chatId }
        if (params.expireDate) body.expire_date = params.expireDate
        if (params.memberLimit) body.member_limit = params.memberLimit
        if (params.createJoinRequest) body.creates_join_request = params.createJoinRequest
        const r = await this.tgFetch('createChatInviteLink', body)
        return { inviteLink: r.result?.invite_link, status: 'created' }
      }
      case 'get_chat': {
        const chatId = params.chat_id || params.chatId
        if (!chatId) throw new Error('Telegram: chat_id required')
        const r = await this.tgFetch('getChat', { chat_id: chatId })
        return { id: r.result?.id, type: r.result?.type, title: r.result?.title, username: r.result?.username, description: r.result?.description, memberCount: r.result?.member_count }
      }
      default:
        throw new Error(`Telegram: unknown action ${action}`)
    }
  }
}

// ─── Airtable (Real REST API) ─────────────────────────────
export class AirtableProvider extends BaseProvider {
  private get apiKey(): string {
    return this.credentials?.api_key || this.credentials?.personal_access_token || this.credentials?.access_token || ''
  }

  private async airtableFetch(baseId: string, tableId: string, path?: string, opts?: RequestInit): Promise<any> {
    const key = this.apiKey
    if (!key) throw new Error('Airtable: no API key configured')
    const r = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}${path || ''}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...opts?.headers,
      },
    })
    if (!r.ok) {
      const err = await r.text()
      throw new Error(`Airtable API error: ${r.status} ${err}`)
    }
    return r.json()
  }

  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    const baseId = params.baseId || this.credentials?.base_id
    const tableId = params.tableId || params.table || params.tableName

    switch (action) {
      case 'list_records': {
        if (!baseId || !tableId) throw new Error('Airtable: baseId and tableId/table required')
        const query = new URLSearchParams()
        if (params.maxRecords) query.set('maxRecords', String(params.maxRecords))
        if (params.view) query.set('view', params.view)
        if (params.filterByFormula) query.set('filterByFormula', params.filterByFormula)
        if (params.sort) query.set('sort', JSON.stringify(params.sort))
        if (params.fields) {
          for (const f of params.fields) query.append('fields[]', f)
        }
        const qs = query.toString()
        const r = await this.airtableFetch(baseId, tableId, qs ? `?${qs}` : '')
        return {
          records: r.records?.map((rec: any) => ({
            id: rec.id, createdTime: rec.createdTime, fields: rec.fields,
          })) ?? [],
          offset: r.offset ?? null,
        }
      }
      case 'get_record': {
        if (!baseId || !tableId || !params.recordId) throw new Error('Airtable: baseId, tableId, and recordId required')
        const r = await this.airtableFetch(baseId, tableId, `/${params.recordId}`)
        return { id: r.id, createdTime: r.createdTime, fields: r.fields }
      }
      case 'create_record': {
        if (!baseId || !tableId) throw new Error('Airtable: baseId and tableId required')
        if (!params.fields) throw new Error('Airtable: fields required for create_record')
        const records = Array.isArray(params.fields)
          ? params.fields.map((f: any) => ({ fields: f }))
          : [{ fields: params.fields }]
        const r = await this.airtableFetch(baseId, tableId, '', {
          method: 'POST',
          body: JSON.stringify({ records, typecast: params.typecast ?? true }),
        })
        return {
          records: r.records?.map((rec: any) => ({ id: rec.id, createdTime: rec.createdTime, fields: rec.fields })) ?? [],
          status: 'created',
        }
      }
      case 'update_record': {
        if (!baseId || !tableId || !params.recordId) throw new Error('Airtable: baseId, tableId, and recordId required')
        if (!params.fields) throw new Error('Airtable: fields required for update_record')
        const r = await this.airtableFetch(baseId, tableId, `/${params.recordId}`, {
          method: 'PATCH',
          body: JSON.stringify({ fields: params.fields, typecast: params.typecast ?? true }),
        })
        return { id: r.id, fields: r.fields, status: 'updated' }
      }
      case 'delete_record': {
        if (!baseId || !tableId || !params.recordId) throw new Error('Airtable: baseId, tableId, and recordId required')
        await this.airtableFetch(baseId, tableId, `/${params.recordId}`, { method: 'DELETE' })
        return { recordId: params.recordId, status: 'deleted' }
      }
      case 'list_bases': {
        const key = this.apiKey
        const r = await fetch('https://api.airtable.com/v0/meta/bases', {
          headers: { Authorization: `Bearer ${key}` },
        })
        if (!r.ok) throw new Error(`Airtable meta error: ${r.status}`)
        const data = await r.json()
        return { bases: data.bases?.map((b: any) => ({ id: b.id, name: b.name, permissionLevel: b.permissionLevel })) ?? [] }
      }
      case 'list_tables': {
        if (!baseId) throw new Error('Airtable: baseId required')
        const key = this.apiKey
        const r = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
          headers: { Authorization: `Bearer ${key}` },
        })
        if (!r.ok) throw new Error(`Airtable meta error: ${r.status}`)
        const data = await r.json()
        return {
          tables: data.tables?.map((t: any) => ({
            id: t.id, name: t.name, description: t.description,
            fields: t.fields?.map((f: any) => ({ name: f.name, type: f.type, options: f.options })),
          })) ?? [],
        }
      }
      default:
        throw new Error(`Airtable: unknown action ${action}`)
    }
  }
}

// ─── n8n (Webhook + REST API) ─────────────────────────────
export class N8nProvider extends BaseProvider {
  private get apiKey(): string {
    return this.credentials?.api_key || this.credentials?.access_token || ''
  }
  private get baseUrl(): string {
    return this.credentials?.base_url || this.credentials?.instance_url || 'http://localhost:5678'
  }

  private async n8nFetch(path: string, opts?: RequestInit): Promise<any> {
    const r = await fetch(`${this.baseUrl}/api/v1${path}`, {
      ...opts,
      headers: {
        'X-N8N-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
        ...opts?.headers,
      },
    })
    if (!r.ok) {
      const err = await r.text()
      throw new Error(`n8n API error: ${r.status} ${err}`)
    }
    return r.json()
  }

  private get webhookBaseUrl(): string {
    return this.credentials?.webhook_url || `${this.baseUrl}/webhook`
  }

  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'trigger_workflow': {
        const workflowId = params.workflowId || params.id
        if (!workflowId) throw new Error('n8n: workflowId required')
        const body = params.data || params.payload || {}
        if (params.waitForResponse) {
          const r = await fetch(`${this.webhookBaseUrl}/${workflowId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const data = r.ok ? await r.json().catch(() => null) : null
          return { status: r.ok ? 'completed' : 'failed', statusCode: r.status, response: data }
        }
        await this.n8nFetch(`/workflows/${workflowId}/execute`, {
          method: 'POST',
          body: JSON.stringify({ data: body }),
        })
        return { workflowId, status: 'triggered' }
      }
      case 'create_webhook': {
        const body: Record<string, any> = {
          name: params.name || 'Inlight Webhook',
          nodes: [
            {
              name: 'Webhook',
              type: 'n8n-nodes-base.webhook',
              typeVersion: 1,
              position: [250, 300],
              parameters: {
                path: params.path || `inlight-${Date.now()}`,
                responseMode: params.responseMode || 'lastNode',
                options: {},
              },
            },
            {
              name: 'Respond',
              type: 'n8n-nodes-base.respondToWebhook',
              typeVersion: 1,
              position: [450, 300],
              parameters: {},
            },
          ],
          connections: {},
          settings: { executionOrder: 'v1' },
          staticData: null,
          tags: params.tags || [],
        }
        if (params.httpMethod) body.nodes[0].parameters.httpMethod = params.httpMethod
        const r = await this.n8nFetch('/workflows', { method: 'POST', body: JSON.stringify(body) })
        return {
          workflowId: r.id,
          webhookUrl: `${this.webhookBaseUrl}/${body.nodes[0].parameters.path}`,
          status: 'created',
        }
      }
      case 'list_workflows': {
        const limit = params.limit || 20
        const offset = params.offset || 0
        const r = await this.n8nFetch(`/workflows?limit=${limit}&offset=${offset}&active=true`)
        return {
          workflows: r.data?.map((w: any) => ({
            id: w.id, name: w.name, active: w.active, createdAt: w.createdAt, updatedAt: w.updatedAt,
          })) ?? [],
          total: r.total ?? r.data?.length ?? 0,
        }
      }
      case 'get_workflow': {
        const id = params.workflowId || params.id
        if (!id) throw new Error('n8n: workflowId required')
        const r = await this.n8nFetch(`/workflows/${id}`)
        return {
          id: r.id, name: r.name, active: r.active, nodes: r.nodes?.length ?? 0,
          createdAt: r.createdAt, updatedAt: r.updatedAt,
        }
      }
      case 'activate_workflow': {
        const id = params.workflowId || params.id
        if (!id) throw new Error('n8n: workflowId required')
        await this.n8nFetch(`/workflows/${id}/activate`, { method: 'POST' })
        return { workflowId: id, status: 'activated' }
      }
      case 'deactivate_workflow': {
        const id = params.workflowId || params.id
        if (!id) throw new Error('n8n: workflowId required')
        await this.n8nFetch(`/workflows/${id}/deactivate`, { method: 'POST' })
        return { workflowId: id, status: 'deactivated' }
      }
      case 'send_webhook': {
        const url = params.url || params.webhookUrl
        if (!url) throw new Error('n8n: webhook url required')
        const r = await fetch(url, {
          method: params.method || 'POST',
          headers: { 'Content-Type': 'application/json', ...params.headers },
          body: JSON.stringify(params.data || params.payload || {}),
        })
        const response = r.ok ? await r.json().catch(() => null) : null
        return { status: r.ok ? 'sent' : 'failed', statusCode: r.status, response }
      }
      default:
        throw new Error(`n8n: unknown action ${action}`)
    }
  }
}

// ─── make.com (Webhook + REST API) ────────────────────────
export class MakeProvider extends BaseProvider {
  private get apiKey(): string {
    return this.credentials?.api_key || this.credentials?.access_token || ''
  }
  private get teamId(): string {
    return this.credentials?.team_id || this.credentials?.organization_id || ''
  }
  private get baseUrl(): string {
    return 'https://eu1.make.com/api/v2'
  }

  private async makeFetch(path: string, opts?: RequestInit): Promise<any> {
    const r = await fetch(`${this.baseUrl}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'InlightAgencyOS/1.0',
        ...opts?.headers,
      },
    })
    if (!r.ok) {
      const err = await r.text()
      throw new Error(`make.com API error: ${r.status} ${err}`)
    }
    return r.json()
  }

  private get webhookBaseUrl(): string {
    return this.credentials?.webhook_url || 'https://hook.eu1.make.com'
  }

  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'trigger_scenario': {
        const scenarioId = params.scenarioId || params.id
        if (!scenarioId) throw new Error('make.com: scenarioId required')
        const body = params.data || params.payload || {}
        const r = await this.makeFetch(`/scenarios/${scenarioId}/executions`, {
          method: 'POST',
          body: JSON.stringify({ body }),
        })
        return { executionId: r.execution?.id, scenarioId, status: 'triggered', startedAt: r.execution?.startedAt }
      }
      case 'send_webhook': {
        const webhookId = params.webhookId || params.id
        if (!webhookId && !params.url) throw new Error('make.com: webhookId or url required')
        const url = params.url || `${this.webhookBaseUrl}/${webhookId}`
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...params.headers },
          body: JSON.stringify(params.data || params.payload || {}),
        })
        const response = r.ok ? await r.json().catch(() => null) : null
        return { status: r.ok ? 'sent' : 'failed', statusCode: r.status, response }
      }
      case 'list_scenarios': {
        const teamId = this.teamId
        if (!teamId) throw new Error('make.com: team_id required (set in credentials)')
        const limit = params.limit || 20
        const r = await this.makeFetch(`/scenarios?teamId=${teamId}&limit=${limit}`)
        return {
          scenarios: r.scenarios?.map((s: any) => ({
            id: s.id, name: s.name, description: s.description, active: s.isActive,
            createdAt: s.createdAt, updatedAt: s.updatedAt,
          })) ?? [],
          total: r.scenarios?.length ?? 0,
        }
      }
      case 'get_scenario': {
        const id = params.scenarioId || params.id
        if (!id) throw new Error('make.com: scenarioId required')
        const r = await this.makeFetch(`/scenarios/${id}`)
        return {
          id: r.scenario?.id, name: r.scenario?.name, description: r.scenario?.description,
          active: r.scenario?.isActive, modules: r.scenario?.modules?.length ?? 0,
        }
      }
      case 'get_executions': {
        const scenarioId = params.scenarioId || params.id
        if (!scenarioId) throw new Error('make.com: scenarioId required')
        const limit = params.limit || 10
        const r = await this.makeFetch(`/scenarios/${scenarioId}/executions?limit=${limit}`)
        return {
          executions: r.executions?.map((e: any) => ({
            id: e.id, status: e.status, startedAt: e.startedAt, finishedAt: e.finishedAt,
          })) ?? [],
        }
      }
      case 'create_webhook': {
        const body: Record<string, any> = {
          name: params.name || 'Inlight Webhook',
          type: 'webhooks',
        }
        if (params.teamId) body.teamId = params.teamId
        if (this.teamId) body.teamId = this.teamId
        if (params.scenarioId) body.scenarioId = params.scenarioId
        const r = await this.makeFetch('/webhooks', { method: 'POST', body: JSON.stringify(body) })
        return {
          webhookId: r.webhook?.id,
          webhookUrl: r.webhook?.url || `${this.webhookBaseUrl}/${r.webhook?.id}`,
          status: 'created',
        }
      }
      default:
        throw new Error(`make.com: unknown action ${action}`)
    }
  }
}

// ─── Paddle (Real REST API — Merchant of Record) ─────────────
export class PaddleProvider extends BaseProvider {
  private get apiKey(): string {
    return this.credentials?.api_key || ''
  }

  private async paddleFetch(path: string, opts?: RequestInit): Promise<any> {
    const key = this.apiKey
    if (!key) throw new Error('Paddle: no API key configured')
    const r = await fetch(`https://api.paddle.com${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...opts?.headers,
      },
    })
    const body = await r.json()
    if (!r.ok) throw new Error(`Paddle API error: ${body.error?.detail || body.error?.message || r.status}`)
    return body
  }

  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'create_transaction': {
        const items = (params.items || []).map((i: any) => ({
          price_id: i.priceId || i.price_id,
          quantity: i.quantity || 1,
        }))
        const body: Record<string, any> = { items, currency_code: params.currency || 'USD' }
        if (params.customerId) body.customer_id = params.customerId
        if (params.description) body.description = params.description
        if (params.returnUrl) body.return_url = params.returnUrl
        const txn = await this.paddleFetch('/transactions', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        return {
          transactionId: txn.data?.id,
          status: txn.data?.status,
          total: txn.data?.details?.totals?.total,
          currency: txn.data?.currency_code,
          checkoutUrl: txn.data?.checkout?.url,
          createdAt: txn.data?.created_at,
        }
      }
      case 'list_transactions': {
        const query = new URLSearchParams()
        if (params.status) query.set('status', params.status)
        if (params.customerId) query.set('customer_id', params.customerId)
        if (params.perPage) query.set('per_page', String(params.perPage))
        const result = await this.paddleFetch(`/transactions?${query.toString()}`)
        return {
          transactions: (result.data || []).map((t: any) => ({
            id: t.id, status: t.status, total: t.details?.totals?.total,
            currency: t.currency_code, createdAt: t.created_at,
          })),
          total: (result.meta?.total || result.data?.length || 0),
        }
      }
      case 'create_customer': {
        const body: Record<string, any> = {}
        if (params.email) body.email = params.email
        if (params.name) body.name = params.name
        if (params.locale) body.locale = params.locale
        if (params.customData) body.custom_data = params.customData
        const customer = await this.paddleFetch('/customers', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        return { customerId: customer.data?.id, email: customer.data?.email, name: customer.data?.name, status: 'created' }
      }
      case 'list_products': {
        const query = new URLSearchParams()
        if (params.status) query.set('status', params.status)
        if (params.perPage) query.set('per_page', String(params.perPage || 50))
        const result = await this.paddleFetch(`/products?${query.toString()}`)
        return {
          products: (result.data || []).map((p: any) => ({
            id: p.id, name: p.name, type: p.type, status: p.status,
            taxCategory: p.tax_category, createdAt: p.created_at,
          })),
          total: result.meta?.total || 0,
        }
      }
      case 'get_product': {
        if (!params.productId) throw new Error('Paddle: productId required')
        const product = await this.paddleFetch(`/products/${params.productId}`)
        const p = product.data
        return { id: p.id, name: p.name, type: p.type, status: p.status, taxCategory: p.tax_category, description: p.description, createdAt: p.created_at }
      }
      case 'create_subscription': {
        const body: Record<string, any> = {
          items: (params.items || []).map((i: any) => ({
            price_id: i.priceId || i.price_id,
            quantity: i.quantity || 1,
          })),
          currency_code: params.currency || 'USD',
        }
        if (params.customerId) body.customer_id = params.customerId
        if (params.scheduledChange) body.scheduled_change = params.scheduledChange
        const sub = await this.paddleFetch('/subscriptions', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        return {
          subscriptionId: sub.data?.id,
          status: sub.data?.status,
          nextBillingAt: sub.data?.next_billed_at,
          currency: sub.data?.currency_code,
          createdAt: sub.data?.created_at,
        }
      }
      default:
        throw new Error(`Paddle: unknown action ${action}`)
    }
  }
}

// ─── Resend (Real REST API — Email Delivery) ────────────────
export class ResendProvider extends BaseProvider {
  private get apiKey(): string {
    return this.credentials?.api_key || ''
  }

  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    const key = this.apiKey
    if (!key) throw new Error('Resend: no API key configured')

    switch (action) {
      case 'send_email': {
        const body: Record<string, any> = {
          from: params.from || 'Inlight Agency <onboarding@resend.dev>',
          to: Array.isArray(params.to) ? params.to : [params.to],
          subject: params.subject || 'No subject',
        }
        if (params.text) body.text = params.text
        if (params.html) body.html = params.html
        if (params.replyTo) body.reply_to = params.replyTo
        if (params.cc) body.cc = Array.isArray(params.cc) ? params.cc : [params.cc]
        if (params.bcc) body.bcc = Array.isArray(params.bcc) ? params.bcc : [params.bcc]

        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await r.json()
        if (!r.ok) throw new Error(`Resend error: ${data.message || data.error || r.status}`)
        return { messageId: data.id, to: params.to, subject: params.subject, status: 'sent' }
      }
      case 'get_email': {
        if (!params.emailId) throw new Error('Resend: emailId required')
        const r = await fetch(`https://api.resend.com/emails/${params.emailId}`, {
          headers: { Authorization: `Bearer ${key}` },
        })
        const data = await r.json()
        if (!r.ok) throw new Error(`Resend error: ${data.message || r.status}`)
        return data
      }
      case 'list_audiences': {
        const r = await fetch('https://api.resend.com/audiences', {
          headers: { Authorization: `Bearer ${key}` },
        })
        const data = await r.json()
        if (!r.ok) throw new Error(`Resend error: ${data.message || r.status}`)
        return { audiences: data.data || [] }
      }
      case 'create_contact': {
        const body: Record<string, any> = { email: params.email }
        if (params.firstName) body.first_name = params.firstName
        if (params.lastName) body.last_name = params.lastName
        if (params.unsubscribed) body.unsubscribed = params.unsubscribed
        if (params.audienceId) {
          const r = await fetch(`https://api.resend.com/audiences/${params.audienceId}/contacts`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          const data = await r.json()
          if (!r.ok) throw new Error(`Resend error: ${data.message || r.status}`)
          return { contactId: data.id, email: params.email, status: 'created' }
        }
        throw new Error('Resend: audienceId required to create contact')
      }
      default:
        throw new Error(`Resend: unknown action ${action}`)
    }
  }
}
