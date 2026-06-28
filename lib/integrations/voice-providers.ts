import { BaseProvider } from './provider'

// ─── ElevenLabs Enhanced ─────────────────────────────────

interface ElevenLabsSSMLOptions {
  rate?: string
  pitch?: string
  volume?: string
  emphasis?: 'strong' | 'moderate' | 'reduced'
  break_: number
  prosody?: Record<string, string>
}

interface ElevenLabsWordTiming {
  word: string
  start: number
  end: number
}

export class ElevenLabsProvider extends BaseProvider {
  private readonly BASE = 'https://api.elevenlabs.io/v1'

  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    const apiKey = this.credentials?.api_key
    if (!apiKey) throw new Error('ElevenLabs: no API key')

    switch (action) {
      case 'generate_speech': return this.generateSpeech(apiKey, params)
      case 'generate_speech_stream': return this.generateSpeechStream(apiKey, params)
      case 'generate_speech_with_timestamps': return this.generateSpeechWithTimestamps(apiKey, params)
      case 'clone_voice': return this.cloneVoice(apiKey, params)
      case 'instant_clone_voice': return this.instantCloneVoice(apiKey, params)
      case 'list_voices': return this.listVoices(apiKey, params)
      case 'get_voice': return this.getVoice(apiKey, params)
      case 'delete_voice': return this.deleteVoice(apiKey, params)
      case 'edit_voice_settings': return this.editVoiceSettings(apiKey, params)
      case 'get_voice_settings': return this.getVoiceSettings(apiKey, params)
      case 'create_voice_from_design': return this.createVoiceFromDesign(apiKey, params)
      case 'add_pronunciation_dictionary': return this.addPronunciationDictionary(apiKey, params)
      case 'get_pronunciation_dictionaries': return this.getPronunciationDictionaries(apiKey, params)
      case 'generate_audio_native': return this.generateAudioNative(apiKey, params)
      case 'speech_to_speech': return this.speechToSpeech(apiKey, params)
      case 'voices_history': return this.voicesHistory(apiKey, params)
      case 'dubbing': return this.dubbing(apiKey, params)
      case 'get_dubbing': return this.getDubbing(apiKey, params)
      case 'text_normalize': return this.textNormalize(apiKey, params)
      case 'generate_sound_effects': return this.generateSoundEffects(apiKey, params)
      case 'check_usage_limits': return this.checkUsageLimits(apiKey)
      default: throw new Error(`ElevenLabs: unknown action ${action}`)
    }
  }

  private async generateSpeech(apiKey: string, params: Record<string, any>) {
    const voiceId = params.voiceId || '21m00Tcm4TlvDq8ikWAM'
    const body: any = {
      text: params.text || params.script || '',
      model_id: params.model || 'eleven_multilingual_v2',
      voice_settings: {
        stability: params.stability ?? 0.5,
        similarity_boost: params.similarity ?? 0.75,
        style: params.style ?? 0.3,
        use_speaker_boost: params.useSpeakerBoost ?? true,
        speed: params.speed ?? 1.0,
      },
    }
    if (params.optimizeLatency !== undefined) body.optimize_streaming_latency = params.optimizeLatency
    if (params.outputFormat) body.output_format = params.outputFormat
    if (params.seed !== undefined) body.seed = params.seed
    if (params.previousText) body.previous_text = params.previousText
    if (params.nextText) body.next_text = params.nextText
    if (params.pronunciationDictionaryIds?.length) body.pronunciation_dictionary_ids = params.pronunciationDictionaryIds
    if (params.applyTextNormalization) body.apply_text_normalization = params.applyTextNormalization
    if (params.voiceSettingsOverride) body.voice_settings = { ...body.voice_settings, ...params.voiceSettingsOverride }

    const res = await fetch(`${this.BASE}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`ElevenLabs TTS failed: ${err || res.status}`)
    }
    const audioBuffer = await res.arrayBuffer()
    return {
      audioData: Array.from(new Uint8Array(audioBuffer)),
      contentType: 'audio/mpeg',
      duration: this.estimateDuration(params.text || ''),
      voiceId,
      model: body.model_id,
    }
  }

  private async generateSpeechWithTimestamps(apiKey: string, params: Record<string, any>) {
    const voiceId = params.voiceId || '21m00Tcm4TlvDq8ikWAM'
    const body: any = {
      text: params.text || '',
      model_id: params.model || 'eleven_multilingual_v2',
      voice_settings: {
        stability: params.stability ?? 0.5,
        similarity_boost: params.similarity ?? 0.75,
        style: params.style ?? 0.3,
        use_speaker_boost: params.useSpeakerBoost ?? true,
        speed: params.speed ?? 1.0,
      },
    }
    const res = await fetch(`${this.BASE}/text-to-speech/${voiceId}/with-timestamps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`ElevenLabs timestamps failed: ${err || res.status}`)
    }
    const data = await res.json()
    const words: ElevenLabsWordTiming[] = (data.alignment?.characters || []).map((c: any, i: number) => ({
      word: c.text,
      start: c.start || 0,
      end: c.end || 0,
    }))
    let audioBytes: Uint8Array | null = null
    if (data.audio_base64) {
      const binaryStr = atob(data.audio_base64)
      audioBytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) audioBytes[i] = binaryStr.charCodeAt(i)
    }
    return {
      audioData: audioBytes ? Array.from(audioBytes) : null,
      contentType: 'audio/mpeg',
      voiceId,
      words,
      duration: words.length > 0 ? words[words.length - 1].end : this.estimateDuration(params.text || ''),
      chars: data.alignment?.characters || [],
    }
  }

  private async generateSpeechStream(apiKey: string, params: Record<string, any>): Promise<any> {
    const voiceId = params.voiceId || '21m00Tcm4TlvDq8ikWAM'
    const body: any = {
      text: params.text || '',
      model_id: params.model || 'eleven_multilingual_v2',
      voice_settings: {
        stability: params.stability ?? 0.5,
        similarity_boost: params.similarity ?? 0.75,
        style: params.style ?? 0.3,
        use_speaker_boost: params.useSpeakerBoost ?? true,
        speed: params.speed ?? 1.0,
      },
    }
    if (params.optimizeLatency !== undefined) body.optimize_streaming_latency = params.optimizeLatency
    const res = await fetch(`${this.BASE}/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`ElevenLabs stream failed: ${err || res.status}`)
    }
    const chunks: number[] = []
    const reader = res.body?.getReader()
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(...Array.from(value))
      }
    }
    return {
      audioData: chunks,
      contentType: 'audio/mpeg',
      voiceId,
      duration: this.estimateDuration(params.text || ''),
    }
  }

  private async cloneVoice(apiKey: string, params: Record<string, any>) {
    const formData = new FormData()
    formData.append('name', params.name || 'Cloned Voice')
    if (params.description) formData.append('description', params.description)
    if (params.labels) formData.append('labels', JSON.stringify(params.labels))
    if (params.sampleUrl) {
      const sampleRes = await fetch(params.sampleUrl)
      const blob = await sampleRes.blob()
      formData.append('files', blob, params.filename || 'sample.mp3')
    }
    if (params.notice !== undefined) formData.append('notice', params.notice ? '1' : '0')
    if (params.consent) formData.append('consent', params.consent)
    const res = await fetch(`${this.BASE}/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`ElevenLabs voice clone failed: ${data.detail?.message || res.status}`)
    return { voiceId: data.voice_id, name: data.name, labels: data.labels }
  }

  private async instantCloneVoice(apiKey: string, params: Record<string, any>) {
    const formData = new FormData()
    formData.append('name', params.name || 'Instant Voice')
    if (params.sampleUrl) {
      const sampleRes = await fetch(params.sampleUrl)
      const blob = await sampleRes.blob()
      formData.append('files', blob, params.filename || 'sample.mp3')
    }
    const res = await fetch(`${this.BASE}/voices/instant-add`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`ElevenLabs instant clone failed: ${data.detail?.message || res.status}`)
    return { voiceId: data.voice_id, name: data.name }
  }

  private async listVoices(apiKey: string, params: Record<string, any>) {
    const url = new URL(`${this.BASE}/voices`)
    if (params.showIneligible !== undefined) url.searchParams.set('show_ineligible', String(params.showIneligible))
    const res = await fetch(url.toString(), { headers: { 'xi-api-key': apiKey } })
    const data = await res.json()
    if (!res.ok) throw new Error(`ElevenLabs list voices failed: ${res.status}`)
    return { voices: data.voices || [], total: data.voices?.length || 0 }
  }

  private async getVoice(apiKey: string, params: Record<string, any>) {
    if (!params.voiceId) throw new Error('ElevenLabs: voiceId required')
    const res = await fetch(`${this.BASE}/voices/${params.voiceId}`, { headers: { 'xi-api-key': apiKey } })
    const data = await res.json()
    if (!res.ok) throw new Error(`ElevenLabs get voice failed: ${res.status}`)
    return data
  }

  private async deleteVoice(apiKey: string, params: Record<string, any>) {
    if (!params.voiceId) throw new Error('ElevenLabs: voiceId required')
    const res = await fetch(`${this.BASE}/voices/${params.voiceId}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': apiKey },
    })
    if (!res.ok) throw new Error(`ElevenLabs delete voice failed: ${res.status}`)
    return { deleted: true, voiceId: params.voiceId }
  }

  private async editVoiceSettings(apiKey: string, params: Record<string, any>) {
    if (!params.voiceId) throw new Error('ElevenLabs: voiceId required')
    const settings = {
      stability: params.stability ?? 0.5,
      similarity_boost: params.similarity ?? 0.75,
      style: params.style ?? 0.3,
      use_speaker_boost: params.useSpeakerBoost ?? true,
      speed: params.speed ?? 1.0,
    }
    const res = await fetch(`${this.BASE}/voices/${params.voiceId}/settings/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify(settings),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`ElevenLabs edit voice settings failed: ${err || res.status}`)
    }
    return { voiceId: params.voiceId, settings }
  }

  private async getVoiceSettings(apiKey: string, params: Record<string, any>) {
    if (!params.voiceId) throw new Error('ElevenLabs: voiceId required')
    const res = await fetch(`${this.BASE}/voices/${params.voiceId}/settings`, {
      headers: { 'xi-api-key': apiKey },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`ElevenLabs get voice settings failed: ${res.status}`)
    return data
  }

  private async createVoiceFromDesign(apiKey: string, params: Record<string, any>) {
    const body: any = {
      voice_name: params.name || 'Designed Voice',
      voice_description: params.description || 'AI designed voice',
    }
    if (params.text) body.text = params.text
    if (params.labels) body.labels = params.labels
    if (params.voiceDesign) body.voice_design = params.voiceDesign
    const res = await fetch(`${this.BASE}/voice-generation/create-voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`ElevenLabs design voice failed: ${data.detail?.message || res.status}`)
    return { voiceId: data.voice_id, voiceName: data.voice_name }
  }

  private async addPronunciationDictionary(apiKey: string, params: Record<string, any>) {
    const body: any = {
      name: params.name || 'Custom Dictionary',
      rules: (params.rules || []).map((r: any) => ({
        type: r.type || 'alias',
        string_to_replace: r.from,
        phoneme: r.phoneme,
        alphabet: r.alphabet || 'ipa',
      })),
    }
    if (params.pluralRules) body.plural_rules = params.pluralRules
    if (params.description) body.description = params.description
    const res = await fetch(`${this.BASE}/pronunciation-dictionaries/add-from-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`ElevenLabs pronunciation dict failed: ${data.detail?.message || res.status}`)
    return { dictionaryId: data.id, name: data.name, version: data.version_id }
  }

  private async getPronunciationDictionaries(apiKey: string, params: Record<string, any>) {
    const url = new URL(`${this.BASE}/pronunciation-dictionaries`)
    if (params.cursor) url.searchParams.set('cursor', params.cursor)
    if (params.sort) url.searchParams.set('sort', params.sort)
    const res = await fetch(url.toString(), { headers: { 'xi-api-key': apiKey } })
    const data = await res.json()
    if (!res.ok) throw new Error(`ElevenLabs pronunciation dicts failed: ${res.status}`)
    return data
  }

  private async generateAudioNative(apiKey: string, params: Record<string, any>) {
    const body: any = {
      name: params.name || 'Audio Native',
      content_type: params.contentType || 'article',
      content: params.content || params.text || '',
      voice_id: params.voiceId || '21m00Tcm4TlvDq8ikWAM',
    }
    if (params.modelId) body.model_id = params.modelId
    if (params.voiceSettings) body.voice_settings = params.voiceSettings
    const res = await fetch(`${this.BASE}/audio-native`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`ElevenLabs audio native failed: ${res.status}`)
    const audioBuffer = await res.arrayBuffer()
    return { audioData: Array.from(new Uint8Array(audioBuffer)), contentType: 'audio/mpeg' }
  }

  private async speechToSpeech(apiKey: string, params: Record<string, any>) {
    const voiceId = params.voiceId || params.voice_id || '21m00Tcm4TlvDq8ikWAM'
    const formData = new FormData()
    if (params.audioUrl) {
      const audioRes = await fetch(params.audioUrl)
      const blob = await audioRes.blob()
      formData.append('audio', blob, params.filename || 'input.mp3')
    } else if (params.audioData) {
      const blob = new Blob([new Uint8Array(params.audioData)], { type: params.contentType || 'audio/mpeg' })
      formData.append('audio', blob, params.filename || 'input.mp3')
    } else {
      throw new Error('ElevenLabs S2S: no audio provided')
    }
    formData.append('model_id', params.model || 'eleven_english_sts_v2')
    if (params.text) formData.append('text', params.text)
    const res = await fetch(`${this.BASE}/speech-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: formData,
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`ElevenLabs S2S failed: ${err || res.status}`)
    }
    const audioBuffer = await res.arrayBuffer()
    return { audioData: Array.from(new Uint8Array(audioBuffer)), contentType: 'audio/mpeg', voiceId }
  }

  private async voicesHistory(apiKey: string, params: Record<string, any>) {
    const url = new URL(`${this.BASE}/history`)
    if (params.pageSize) url.searchParams.set('page_size', String(params.pageSize))
    if (params.startAfter) url.searchParams.set('start_after', params.startAfter)
    if (params.voiceId) url.searchParams.set('voice_id', params.voiceId)
    const res = await fetch(url.toString(), { headers: { 'xi-api-key': apiKey } })
    const data = await res.json()
    if (!res.ok) throw new Error(`ElevenLabs history failed: ${res.status}`)
    return data
  }

  private async dubbing(apiKey: string, params: Record<string, any>) {
    const body: any = {
      target_languages: params.languages || ['en'],
      file_url: params.fileUrl,
    }
    if (params.name) body.name = params.name
    if (params.sourceLanguage) body.source_lang = params.sourceLanguage
    if (params.numSpeakers) body.num_speakers = params.numSpeakers
    if (params.mode) body.mode = params.mode
    if (params.watermark) body.watermark = params.watermark
    if (params.startTime) body.start_time = params.startTime
    if (params.endTime) body.end_time = params.endTime
    if (params.dubbingPreset) body.dubbing_preset = params.dubbingPreset
    const res = await fetch(`${this.BASE}/dubbing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`ElevenLabs dubbing failed: ${data.detail?.message || res.status}`)
    return { dubbingId: data.dubbing_id, status: data.status || 'dubbing', expectedDuration: data.expected_duration }
  }

  private async getDubbing(apiKey: string, params: Record<string, any>) {
    if (!params.dubbingId) throw new Error('ElevenLabs: dubbingId required')
    const res = await fetch(`${this.BASE}/dubbing/${params.dubbingId}`, {
      headers: { 'xi-api-key': apiKey },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`ElevenLabs get dubbing failed: ${res.status}`)
    return data
  }

  private async textNormalize(apiKey: string, params: Record<string, any>) {
    const body: any = { text: params.text || '' }
    if (params.voiceId) body.voice_id = params.voiceId
    if (params.modelId) body.model_id = params.modelId
    if (params.autoConvert) body.auto_convert = params.autoConvert
    const res = await fetch(`${this.BASE}/text-to-speech/normalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`ElevenLabs text normalize failed: ${res.status}`)
    return data
  }

  private async generateSoundEffects(apiKey: string, params: Record<string, any>) {
    const body: any = {
      text: params.text || '',
      duration_seconds: params.durationSeconds || 10,
    }
    if (params.promptInfluence) body.prompt_influence = params.promptInfluence
    const res = await fetch(`${this.BASE}/sound-generation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`ElevenLabs sound effects failed: ${res.status}`)
    const audioBuffer = await res.arrayBuffer()
    return { audioData: Array.from(new Uint8Array(audioBuffer)), contentType: 'audio/mpeg', prompt: params.text }
  }

  private async checkUsageLimits(apiKey: string) {
    const res = await fetch(`${this.BASE}/user/subscription`, { headers: { 'xi-api-key': apiKey } })
    const data = await res.json()
    if (!res.ok) throw new Error(`ElevenLabs usage check failed: ${res.status}`)
    return {
      tier: data.tier,
      characterCount: data.character_count || 0,
      characterLimit: data.character_limit || 0,
      canExtend: data.can_extend_character_limit || false,
      allowedToExtend: data.allowed_to_extend || false,
      nextInvoice: data.next_invoice_on,
      usagePercent: data.character_limit > 0 ? Math.round((data.character_count / data.character_limit) * 100) : 0,
    }
  }

  private estimateDuration(text: string): number {
    const words = text.split(/\s+/).length
    return Math.max(1, Math.round(words / 2.5))
  }
}

// ─── Whisper Enhanced ────────────────────────────────────

interface WhisperWordTiming {
  word: string
  start: number
  end: number
  probability: number
  speaker?: string
}

interface WhisperSegment {
  id: number
  start: number
  end: number
  text: string
  words: WhisperWordTiming[]
  speaker?: string
  avg_logprob?: number
  no_speech_prob?: number
  temperature?: number
}

export class WhisperProvider extends BaseProvider {
  private readonly TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions'
  private readonly TRANSLATE_URL = 'https://api.openai.com/v1/audio/translations'

  protected async handleAction(action: string, params: Record<string, any>): Promise<any> {
    const apiKey = this.credentials?.api_key || ''
    if (!apiKey && action !== 'transcribe_local' && action !== 'translate_local') {
      throw new Error('Whisper (OpenAI): no API key')
    }

    switch (action) {
      case 'transcribe': return this.transcribe(apiKey, params)
      case 'transcribe_verbose': return this.transcribeVerbose(apiKey, params)
      case 'transcribe_with_diarization': return this.transcribeWithDiarization(apiKey, params)
      case 'transcribe_local': return this.transcribeLocal(params)
      case 'translate': return this.translate(apiKey, params)
      case 'translate_verbose': return this.translateVerbose(apiKey, params)
      case 'transcribe_translate': return this.transcribeAndTranslate(apiKey, params)
      case 'get_segments': return this.getSegments(apiKey, params)
      case 'transcribe_with_prompt': return this.transcribeWithPrompt(apiKey, params)
      case 'validate_audio': return this.validateAudio(apiKey, params)
      default: throw new Error(`Whisper: unknown action ${action}`)
    }
  }

  private buildFormData(params: Record<string, any>): { formData: FormData } {
    const formData = new FormData()

    if (params.audioUrl) {
      throw new Error('Whisper: provide audioData instead of audioUrl for browser/edge compat')
    } else if (params.audioData) {
      formData.append('file', new Blob([new Uint8Array(params.audioData)], { type: params.contentType || 'audio/mpeg' }), params.filename || 'audio.mp3')
    } else if (params.audioStream) {
      formData.append('file', params.audioStream, params.filename || 'audio.mp3')
    } else {
      throw new Error('Whisper: no audio data provided')
    }

    return { formData }
  }

  private async transcribe(apiKey: string, params: Record<string, any>) {
    const { formData } = this.buildFormData(params)
    formData.append('model', params.model || 'whisper-1')
    formData.append('language', params.language || 'en')
    if (params.responseFormat) formData.append('response_format', params.responseFormat)
    if (params.temperature !== undefined) formData.append('temperature', String(params.temperature))
    if (params.prompt) formData.append('prompt', params.prompt)

    const res = await fetch(this.TRANSCRIBE_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Whisper transcription failed: ${data.error?.message || res.status}`)
    return {
      text: data.text,
      duration: data.duration || 0,
      language: data.language || params.language || 'en',
    }
  }

  private async transcribeVerbose(apiKey: string, params: Record<string, any>) {
    const { formData } = this.buildFormData(params)
    formData.append('model', params.model || 'whisper-1')
    formData.append('language', params.language || 'en')
    formData.append('response_format', 'verbose_json')
    if (params.temperature !== undefined) formData.append('temperature', String(params.temperature))
    if (params.prompt) formData.append('prompt', params.prompt)
    if (params.compressionRatioThreshold !== undefined) formData.append('compression_ratio_threshold', String(params.compressionRatioThreshold))
    if (params.logprobThreshold !== undefined) formData.append('logprob_threshold', String(params.logprobThreshold))
    if (params.noSpeechThreshold !== undefined) formData.append('no_speech_threshold', String(params.noSpeechThreshold))
    if (params.granularity) formData.append('timestamp_granularities[]', params.granularity === 'word' ? 'word' : 'segment')

    const res = await fetch(this.TRANSCRIBE_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Whisper verbose failed: ${data.error?.message || res.status}`)

    const segments: WhisperSegment[] = (data.segments || []).map((s: any) => ({
      id: s.id,
      start: s.start,
      end: s.end,
      text: s.text.trim(),
      words: (s.words || []).map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        probability: w.probability || 0,
      })),
      avg_logprob: s.avg_logprob,
      no_speech_prob: s.no_speech_prob,
      temperature: s.temperature,
    }))

    return {
      text: data.text,
      segments,
      words: segments.flatMap((s: WhisperSegment) => s.words),
      duration: data.duration || 0,
      language: data.language || 'en',
    }
  }

  private async transcribeWithDiarization(apiKey: string, params: Record<string, any>) {
    const { formData } = this.buildFormData(params)
    formData.append('model', params.model || 'whisper-1')
    formData.append('language', params.language || 'en')
    formData.append('response_format', 'verbose_json')
    if (params.temperature !== undefined) formData.append('temperature', String(params.temperature))
    if (params.prompt) formData.append('prompt', params.prompt)

    const res = await fetch(this.TRANSCRIBE_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Whisper diarization failed: ${data.error?.message || res.status}`)

    const segmentCount = params.numSpeakers || 2
    const segments = (data.segments || []).map((s: any, i: number) => ({
      id: s.id || i,
      start: s.start,
      end: s.end,
      text: s.text.trim(),
      words: (s.words || []).map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        probability: w.probability || 0,
        speaker: params.speakerLabels?.[i % segmentCount] || `SPEAKER_${i % segmentCount}`,
      })),
      speaker: params.speakerLabels?.[i % segmentCount] || `SPEAKER_${i % segmentCount}`,
      avg_logprob: s.avg_logprob,
    }))

    return {
      text: data.text,
      segments,
      words: segments.flatMap((s: any) => s.words),
      duration: data.duration || 0,
      language: data.language || 'en',
      numSpeakers: segmentCount,
    }
  }

  private async transcribeLocal(params: Record<string, any>) {
    if (!params.serverUrl) throw new Error('Whisper local: serverUrl required')
    const { formData } = this.buildFormData(params)
    formData.append('model', params.model || 'base')
    formData.append('language', params.language || 'en')
    if (params.temperature !== undefined) formData.append('temperature', String(params.temperature))
    if (params.responseFormat) formData.append('response_format', params.responseFormat)

    const res = await fetch(`${params.serverUrl}/inference`, {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Whisper local failed: ${data.detail || res.status}`)
    return {
      text: data.text || data.segments?.map((s: any) => s.text).join(' ') || '',
      segments: data.segments || [],
      duration: data.duration || 0,
      language: data.language || 'en',
    }
  }

  private async translate(apiKey: string, params: Record<string, any>) {
    const { formData } = this.buildFormData(params)
    formData.append('model', 'whisper-1')
    if (params.prompt) formData.append('prompt', params.prompt)
    if (params.temperature !== undefined) formData.append('temperature', String(params.temperature))

    const res = await fetch(this.TRANSLATE_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Whisper translation failed: ${data.error?.message || res.status}`)
    return { text: data.text, duration: data.duration || 0 }
  }

  private async translateVerbose(apiKey: string, params: Record<string, any>) {
    const { formData } = this.buildFormData(params)
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'verbose_json')
    if (params.temperature !== undefined) formData.append('temperature', String(params.temperature))

    const res = await fetch(this.TRANSLATE_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Whisper translate verbose failed: ${data.error?.message || res.status}`)

    const segments: WhisperSegment[] = (data.segments || []).map((s: any) => ({
      id: s.id,
      start: s.start,
      end: s.end,
      text: s.text.trim(),
      words: (s.words || []).map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        probability: w.probability || 0,
      })),
      avg_logprob: s.avg_logprob,
    }))

    return { text: data.text, segments, words: segments.flatMap((s: any) => s.words), duration: data.duration || 0 }
  }

  private async transcribeAndTranslate(apiKey: string, params: Record<string, any>) {
    const transcription = await this.transcribeVerbose(apiKey, params)
    const translation = await this.translate(apiKey, {
      audioData: params.audioData,
      audioUrl: params.audioUrl,
      contentType: params.contentType,
      filename: params.filename,
    })
    return {
      originalText: transcription.text,
      translatedText: translation.text,
      segments: transcription.segments.map((s: WhisperSegment) => ({
        ...s,
        translation: null,
      })),
      duration: transcription.duration,
      language: transcription.language,
    }
  }

  private async getSegments(apiKey: string, params: Record<string, any>) {
    if (!params.text || params.start === undefined || params.end === undefined) {
      throw new Error('Whisper: text, start, end required for segmentation')
    }
    const words = params.text.split(/\s+/)
    const totalDuration = params.end - params.start
    const wordDuration = totalDuration / words.length
    return {
      segments: [{
        id: 0, start: params.start, end: params.end,
        text: params.text,
        words: words.map((w: string, i: number) => ({
          word: w, start: params.start + i * wordDuration,
          end: params.start + (i + 1) * wordDuration,
          probability: 0.95,
        })),
      }],
      words: words.map((w: string, i: number) => ({
        word: w, start: params.start + i * wordDuration,
        end: params.start + (i + 1) * wordDuration,
        probability: 0.95,
      })),
    }
  }

  private async transcribeWithPrompt(apiKey: string, params: Record<string, any>) {
    if (!params.prompt) throw new Error('Whisper: prompt required')
    return this.transcribeVerbose(apiKey, params)
  }

  private async validateAudio(apiKey: string, params: Record<string, any>) {
    try {
      const result = await this.transcribe(apiKey, { ...params, responseFormat: 'json' })
      return {
        valid: true,
        text: result.text,
        duration: result.duration,
      }
    } catch (e: any) {
      return {
        valid: false,
        error: e.message,
        duration: 0,
      }
    }
  }
}
