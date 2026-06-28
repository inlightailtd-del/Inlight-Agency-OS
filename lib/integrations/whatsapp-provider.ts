import { BaseProvider } from './provider'

const WA_API = 'https://graph.facebook.com/v22.0'

export class WhatsAppProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    const token = this.credentials?.access_token || this.credentials?.api_key
    if (!token) throw new Error('WhatsApp: no access token or API key')

    const phoneNumberId = params.phoneNumberId || this.credentials?.phone_number_id
    const wabaId = params.wabaId || this.credentials?.waba_id
    const bizId = params.businessId || this.credentials?.business_id

    switch (action) {
      case 'send_text': return this.sendText(token, phoneNumberId, params)
      case 'send_template': return this.sendTemplate(token, phoneNumberId, params)
      case 'send_image': return this.sendMedia(token, phoneNumberId, 'image', params)
      case 'send_audio': return this.sendMedia(token, phoneNumberId, 'audio', params)
      case 'send_document': return this.sendMedia(token, phoneNumberId, 'document', params)
      case 'send_video': return this.sendMedia(token, phoneNumberId, 'video', params)
      case 'send_sticker': return this.sendMedia(token, phoneNumberId, 'sticker', params)
      case 'send_location': return this.sendLocation(token, phoneNumberId, params)
      case 'send_interactive_buttons': return this.sendInteractiveButtons(token, phoneNumberId, params)
      case 'send_interactive_list': return this.sendInteractiveList(token, phoneNumberId, params)
      case 'send_cta': return this.sendCTA(token, phoneNumberId, params)
      case 'send_reaction': return this.sendReaction(token, phoneNumberId, params)
      case 'send_contacts': return this.sendContacts(token, phoneNumberId, params)
      case 'mark_read': return this.markRead(token, phoneNumberId, params)
      case 'upload_media': return this.uploadMedia(token, phoneNumberId, params)
      case 'get_media': return this.getMedia(token, params)
      case 'download_media': return this.downloadMedia(token, params)
      case 'delete_media': return this.deleteMedia(token, params)
      case 'create_template': return this.createTemplate(token, wabaId, params)
      case 'get_templates': return this.getTemplates(token, wabaId, params)
      case 'edit_template': return this.editTemplate(token, wabaId, params)
      case 'delete_template': return this.deleteTemplate(token, wabaId, params)
      case 'get_phone_numbers': return this.getPhoneNumbers(token, bizId)
      case 'register_phone': return this.registerPhone(token, params)
      case 'get_business_profile': return this.getBusinessProfile(token, phoneNumberId)
      case 'update_business_profile': return this.updateBusinessProfile(token, phoneNumberId, params)
      case 'subscribe_webhook': return this.subscribeWebhook(token, wabaId)
      case 'get_webhook_status': return this.getWebhookStatus(token, wabaId)
      case 'conversation_analytics': return this.getConversationAnalytics(token, wabaId, params)
      default: throw new Error(`WhatsApp: unknown action ${action}`)
    }
  }

  private async post(token: string, path: string, body: any) {
    const url = path.startsWith('http') ? path : `${WA_API}${path}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`WhatsApp API error: ${data.error?.message || JSON.stringify(data)}`)
    return data
  }

  private async get(token: string, path: string) {
    const url = path.startsWith('http') ? path : `${WA_API}${path}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (!res.ok) throw new Error(`WhatsApp API error: ${data.error?.message || JSON.stringify(data)}`)
    return data
  }

  private async del(token: string, path: string) {
    const res = await fetch(`${WA_API}${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(`WhatsApp API error: ${data.error?.message || res.status}`)
    }
    return { deleted: true }
  }

  private sendText(token: string, phoneNumberId: string, params: Record<string, any>) {
    const body: any = {
      messaging_product: 'whatsapp',
      to: params.to,
      type: 'text',
      text: { body: params.text || params.body || '', preview_url: params.previewUrl ?? false },
    }
    if (params.contextMessageId) body.context = { message_id: params.contextMessageId }
    return this.post(token, `/${phoneNumberId}/messages`, body)
  }

  private sendTemplate(token: string, phoneNumberId: string, params: Record<string, any>) {
    const components: any[] = []
    if (params.headerParams?.length) {
      components.push({ type: 'header', parameters: params.headerParams.map((v: any) => this.toParam(v)) })
    }
    if (params.bodyParams?.length) {
      components.push({ type: 'body', parameters: params.bodyParams.map((v: any) => this.toParam(v)) })
    }
    if (params.buttonParams?.length) {
      components.push({ type: 'button', sub_type: 'url', index: params.buttonIndex ?? 0, parameters: [{ type: 'text', text: params.buttonParams[0] }] })
    }
    const body: any = {
      messaging_product: 'whatsapp',
      to: params.to,
      type: 'template',
      template: {
        name: params.templateName || params.name,
        language: { code: params.language || 'en', policy: params.policy || 'deterministic' },
      },
    }
    if (components.length > 0) body.template.components = components
    if (params.contextMessageId) body.context = { message_id: params.contextMessageId }
    return this.post(token, `/${phoneNumberId}/messages`, body)
  }

  private toParam(value: any): any {
    if (typeof value === 'string') {
      if (value.startsWith('http') && (value.includes('.png') || value.includes('.jpg') || value.includes('.jpeg'))) {
        return { type: 'image', image: { link: value } }
      }
      if (value.startsWith('http') && value.includes('.pdf')) {
        return { type: 'document', document: { link: value, filename: 'document.pdf' } }
      }
      return { type: 'text', text: value }
    }
    if (value?.type) return value
    return { type: 'text', text: String(value) }
  }

  private sendMedia(token: string, phoneNumberId: string, mediaType: string, params: Record<string, any>) {
    const body: any = {
      messaging_product: 'whatsapp',
      to: params.to,
      type: mediaType,
      [mediaType]: { id: params.mediaId, link: params.link },
    }
    if (params.caption && ['image', 'video', 'document'].includes(mediaType)) {
      body[mediaType].caption = params.caption
    }
    if (params.filename && mediaType === 'document') body[mediaType].filename = params.filename
    if (params.provider) body[mediaType].provider = params.provider
    if (params.contextMessageId) body.context = { message_id: params.contextMessageId }
    return this.post(token, `/${phoneNumberId}/messages`, body)
  }

  private sendLocation(token: string, phoneNumberId: string, params: Record<string, any>) {
    const body: any = {
      messaging_product: 'whatsapp',
      to: params.to,
      type: 'location',
      location: {
        latitude: params.latitude,
        longitude: params.longitude,
        name: params.name,
        address: params.address,
      },
    }
    return this.post(token, `/${phoneNumberId}/messages`, body)
  }

  private sendInteractiveButtons(token: string, phoneNumberId: string, params: Record<string, any>) {
    const body: any = {
      messaging_product: 'whatsapp',
      to: params.to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: params.body || params.text || '' },
        action: {
          buttons: (params.buttons || []).slice(0, 3).map((b: any, i: number) => ({
            type: 'reply',
            reply: { id: b.id || `btn_${i}`, title: b.title?.slice(0, 20) || `Option ${i + 1}` },
          })),
        },
      },
    }
    if (params.header) body.interactive.header = params.header
    if (params.footer) body.interactive.footer = { text: params.footer }
    return this.post(token, `/${phoneNumberId}/messages`, body)
  }

  private sendInteractiveList(token: string, phoneNumberId: string, params: Record<string, any>) {
    const body: any = {
      messaging_product: 'whatsapp',
      to: params.to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: params.body || params.text || '' },
        action: {
          button: params.buttonText || 'View Options',
          sections: (params.sections || []).map((s: any) => ({
            title: s.title?.slice(0, 24) || '',
            rows: (s.rows || []).slice(0, 10).map((r: any) => ({
              id: r.id || `row_${Date.now()}`,
              title: r.title?.slice(0, 24) || 'Option',
              description: r.description?.slice(0, 72) || '',
            })),
          })),
        },
      },
    }
    if (params.header) body.interactive.header = params.header
    if (params.footer) body.interactive.footer = { text: params.footer }
    return this.post(token, `/${phoneNumberId}/messages`, body)
  }

  private sendCTA(token: string, phoneNumberId: string, params: Record<string, any>) {
    const body: any = {
      messaging_product: 'whatsapp',
      to: params.to,
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text: params.body || params.text || '' },
        action: {
          name: 'cta_url',
          parameters: {
            display_text: params.buttonText || 'Learn More',
            url: params.url || 'https://example.com',
          },
        },
      },
    }
    if (params.header) body.interactive.header = params.header
    if (params.footer) body.interactive.footer = { text: params.footer }
    return this.post(token, `/${phoneNumberId}/messages`, body)
  }

  private sendReaction(token: string, phoneNumberId: string, params: Record<string, any>) {
    const body: any = {
      messaging_product: 'whatsapp',
      to: params.to,
      type: 'reaction',
      reaction: { message_id: params.messageId, emoji: params.emoji || '👍' },
    }
    return this.post(token, `/${phoneNumberId}/messages`, body)
  }

  private sendContacts(token: string, phoneNumberId: string, params: Record<string, any>) {
    const body: any = {
      messaging_product: 'whatsapp',
      to: params.to,
      type: 'contacts',
      contacts: [{
        name: { formatted_name: params.name || params.fullName || '', first_name: params.firstName, last_name: params.lastName },
        phones: [{ phone: params.phone || params.to, type: 'WORK' }],
        emails: params.email ? [{ email: params.email }] : undefined,
        org: params.company ? { company: params.company } : undefined,
      }],
    }
    return this.post(token, `/${phoneNumberId}/messages`, body)
  }

  private markRead(token: string, phoneNumberId: string, params: Record<string, any>) {
    return this.post(token, `/${phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: params.messageId,
    })
  }

  private async uploadMedia(token: string, phoneNumberId: string, params: Record<string, any>) {
    const formData = new FormData()
    formData.append('messaging_product', 'whatsapp')
    if (params.fileUrl) {
      const fileRes = await fetch(params.fileUrl)
      const blob = await fileRes.blob()
      formData.append('file', blob, params.filename || 'file')
    } else if (params.fileData) {
      const blob = new Blob([new Uint8Array(params.fileData)], { type: params.contentType || 'application/octet-stream' })
      formData.append('file', blob, params.filename || 'file')
    } else {
      throw new Error('WhatsApp upload: no file data')
    }
    if (params.type) formData.append('type', params.type)
    const res = await fetch(`${WA_API}/${phoneNumberId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`WhatsApp upload error: ${data.error?.message || JSON.stringify(data)}`)
    return { mediaId: data.id }
  }

  private async getMedia(token: string, params: Record<string, any>) {
    return this.get(token, `/${params.mediaId}`)
  }

  private async downloadMedia(token: string, params: Record<string, any>) {
    const info = await this.getMedia(token, params)
    const url = info.url
    if (!url) throw new Error('WhatsApp: media URL not available')
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`WhatsApp download failed: ${res.status}`)
    const buffer = await res.arrayBuffer()
    return { mediaData: Array.from(new Uint8Array(buffer)), mimeType: info.mime_type || 'application/octet-stream', filename: info.filename || 'media' }
  }

  private async deleteMedia(token: string, params: Record<string, any>) {
    return this.del(token, `/${params.mediaId}`)
  }

  private async createTemplate(token: string, wabaId: string, params: Record<string, any>) {
    if (!wabaId) throw new Error('WhatsApp: wabaId required for template management')
    const body: any = {
      name: params.name,
      language: params.language || 'en',
      category: params.category || 'MARKETING',
      components: params.components || [],
    }
    if (params.allowCategoryChange !== undefined) body.allow_category_change = params.allowCategoryChange
    return this.post(token, `/${wabaId}/message_templates`, body)
  }

  private async getTemplates(token: string, wabaId: string, params: Record<string, any>) {
    if (!wabaId) throw new Error('WhatsApp: wabaId required')
    let path = `/${wabaId}/message_templates`
    const qps: string[] = []
    if (params.status) qps.push(`status=${params.status}`)
    if (params.name) qps.push(`name=${params.name}`)
    if (params.language) qps.push(`language=${params.language}`)
    if (params.category) qps.push(`category=${params.category}`)
    if (qps.length) path += '?' + qps.join('&')
    return this.get(token, path)
  }

  private async editTemplate(token: string, wabaId: string, params: Record<string, any>) {
    if (!wabaId || !params.templateId) throw new Error('WhatsApp: wabaId and templateId required')
    const body: any = {}
    if (params.components) body.components = params.components
    if (params.category) body.category = params.category
    if (params.allowCategoryChange !== undefined) body.allow_category_change = params.allowCategoryChange
    return this.post(token, `/${wabaId}/message_templates/${params.templateId}`, body)
  }

  private async deleteTemplate(token: string, wabaId: string, params: Record<string, any>) {
    if (!wabaId || !params.templateName) throw new Error('WhatsApp: wabaId and templateName required')
    return this.del(token, `/${wabaId}/message_templates?name=${params.templateName}`)
  }

  private async getPhoneNumbers(token: string, bizId: string) {
    if (!bizId) throw new Error('WhatsApp: businessId required')
    return this.get(token, `/${bizId}/phone_numbers`)
  }

  private async registerPhone(token: string, params: Record<string, any>) {
    return this.post(token, `/${params.phoneNumberId}/register`, {
      messaging_product: 'whatsapp',
      pin: params.pin || '000000',
    })
  }

  private async getBusinessProfile(token: string, phoneNumberId: string) {
    return this.get(token, `/${phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`)
  }

  private async updateBusinessProfile(token: string, phoneNumberId: string, params: Record<string, any>) {
    const body: any = { messaging_product: 'whatsapp' }
    if (params.about !== undefined) body.about = params.about
    if (params.description !== undefined) body.description = params.description
    if (params.email !== undefined) body.email = params.email
    if (params.websites) body.websites = params.websites
    if (params.address !== undefined) body.address = params.address
    if (params.vertical !== undefined) body.vertical = params.vertical
    return this.post(token, `/${phoneNumberId}/whatsapp_business_profile`, body)
  }

  private async subscribeWebhook(token: string, wabaId: string) {
    if (!wabaId) throw new Error('WhatsApp: wabaId required')
    return this.post(token, `/${wabaId}/subscribed_apps`, {})
  }

  private async getWebhookStatus(token: string, wabaId: string) {
    return this.get(token, `/${wabaId}/subscribed_apps`)
  }

  private async getConversationAnalytics(token: string, wabaId: string, params: Record<string, any>) {
    if (!wabaId) throw new Error('WhatsApp: wabaId required')
    const body: any = {
      granularity: params.granularity || 'DAY',
      metric_types: params.metrics || ['CONVERSATION'],
    }
    if (params.start) body.start = params.start
    if (params.end) body.end = params.end
    if (params.conversationTypes) body.conversation_types = params.conversationTypes
    if (params.directions) body.directions = params.directions
    return this.post(token, `/${wabaId}/analytics`, body)
  }
}
