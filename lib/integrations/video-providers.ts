import { BaseProvider } from './provider'

export class RunwayProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    const apiKey = this.credentials?.api_key
    const baseUrl = 'https://api.runwayml.com/v1'

    switch (action) {
      case 'generate_video': {
        if (!apiKey) throw new Error('Runway: no API key')
        const res = await fetch(`${baseUrl}/generations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: params.model || 'gen3',
            prompt: params.prompt || params.script || '',
            duration: params.duration || 10,
            aspect_ratio: params.aspectRatio || '16:9',
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(`Runway generation failed: ${data.error?.message || res.status}`)
        return { generationId: data.id, status: data.status, videoUrl: data.output?.url || null, estimatedTime: data.estimated_time }
      }

      case 'check_generation_status': {
        if (!apiKey) throw new Error('Runway: no API key')
        const res = await fetch(`${baseUrl}/generations/${params.generationId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(`Runway status check failed: ${data.error?.message || res.status}`)
        return { generationId: data.id, status: data.status, videoUrl: data.output?.url || null, progress: data.progress }
      }

      case 'list_models':
        return { models: ['gen1', 'gen2', 'gen3'] }

      default:
        throw new Error(`Runway: unknown action ${action}`)
    }
  }
}

export class VeoProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    const apiKey = this.credentials?.api_key

    switch (action) {
      case 'generate_video': {
        if (!apiKey) throw new Error('Veo: no API key')
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/veo:generateVideo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            prompt: params.prompt || params.script || '',
            duration: params.duration || 8,
            aspectRatio: params.aspectRatio || '16:9',
            personGeneration: params.people || 'dont_allow',
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(`Veo generation failed: ${data.error?.message || res.status}`)
        return { generationId: data.name, status: 'processing', videoUrl: data.video?.uri || null }
      }

      case 'check_generation_status': {
        if (!apiKey) throw new Error('Veo: no API key')
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${params.generationId}`, {
          headers: { 'x-goog-api-key': apiKey },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(`Veo status check failed: ${data.error?.message || res.status}`)
        return { generationId: data.name, status: data.state, videoUrl: data.video?.uri || null }
      }

      default:
        throw new Error(`Veo: unknown action ${action}`)
    }
  }
}

export class PikaProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    const apiKey = this.credentials?.api_key

    switch (action) {
      case 'generate_video': {
        if (!apiKey) throw new Error('Pika: no API key')
        const res = await fetch('https://api.pika.art/v1/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
          body: JSON.stringify({
            prompt: params.prompt || params.script || '',
            negative_prompt: params.negativePrompt || '',
            duration: params.duration || 5,
            aspect_ratio: params.aspectRatio || '16:9',
            motion_amount: params.motion || 3,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(`Pika generation failed: ${data.error?.message || res.status}`)
        return { generationId: data.id, status: data.status, videoUrl: data.output?.url || null }
      }

      case 'check_generation_status': {
        if (!apiKey) throw new Error('Pika: no API key')
        const res = await fetch(`https://api.pika.art/v1/generations/${params.generationId}`, {
          headers: { 'X-API-Key': apiKey },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(`Pika status check failed: ${data.error?.message || res.status}`)
        return { generationId: data.id, status: data.status, videoUrl: data.output?.url || null }
      }

      default:
        throw new Error(`Pika: unknown action ${action}`)
    }
  }
}

export class KlingProvider extends BaseProvider {
  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    const apiKey = this.credentials?.api_key

    switch (action) {
      case 'generate_video': {
        if (!apiKey) throw new Error('Kling: no API key')
        const res = await fetch('https://api.klingai.com/v1/videos/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model_name: params.model || 'kling-v1',
            prompt: params.prompt || params.script || '',
            duration: params.duration || 5,
            resolution: params.resolution || '1088x1088',
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(`Kling generation failed: ${data.error?.message || res.status}`)
        return { generationId: data.data?.task_id, status: data.data?.status || 'pending', videoUrl: null }
      }

      case 'check_generation_status': {
        if (!apiKey) throw new Error('Kling: no API key')
        const res = await fetch(`https://api.klingai.com/v1/videos/status/${params.generationId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(`Kling status check failed: ${data.error?.message || res.status}`)
        return { generationId: data.data?.task_id, status: data.data?.status, videoUrl: data.data?.video?.url || null, progress: data.data?.progress }
      }

      default:
        throw new Error(`Kling: unknown action ${action}`)
    }
  }
}
