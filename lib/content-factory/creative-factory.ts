import type { SupabaseClient } from '@supabase/supabase-js'
import { type ReelPackage, type SceneBreakdown, type VisualPrompt } from '@/lib/reels/package-types'

export interface CreativeAsset {
  assetType: 'thumbnail' | 'cover' | 'carousel_slide' | 'b_roll'
  prompt: string
  enhancedPrompt: string
  negativePrompt: string
  style: string
  aspectRatio: string
}

export interface ThumbnailPrompt {
  concept: string
  composition: string
  colors: string[]
  mood: string
  text: string
  prompt: string
}

export interface CreativeFactoryResult {
  reelPackageId: string
  assetsCreated: number
  promptsGenerated: number
  queueJobs: number
  thumbnail: ThumbnailPrompt | null
  coverPrompt: string | null
  carouselPrompts: string[]
  bRollPack: string[]
  errors: string[]
}

const THUMBNAIL_TEMPLATES = [
  { concept: 'Split face — human on left, AI/tech on right', composition: 'Dual perspective, dramatic contrast lighting', colors: ['#0a0a23', '#00d4ff', '#ffffff'], mood: 'mysterious, futuristic' },
  { concept: 'Abstract data visualization with human silhouette', composition: 'Centered, depth of field, glowing elements', colors: ['#1a0533', '#7c3aed', '#f59e0b'], mood: 'powerful, innovative' },
  { concept: 'AI brain/neural network in glass dome', composition: 'Macro shot, dramatic backlight, floating particles', colors: ['#0f172a', '#06b6d4', '#22c55e'], mood: 'sophisticated, intelligent' },
  { concept: 'Before/after comparison — chaotic desk vs automated workflow', composition: 'Split screen, warm vs cool tones', colors: ['#dc2626', '#16a34a', '#f8fafc'], mood: 'transformative, clean' },
  { concept: 'Floating holographic interface with human hand interacting', composition: 'Low angle, cinematic, depth', colors: ['#020617', '#818cf8', '#e2e8f0'], mood: 'cutting-edge, interactive' },
]

const COVER_TEMPLATES = [
  'Minimalist design with bold typography over abstract gradient — {topic} in large font, subtitle below. Tech aesthetic.',
  'Split composition: real world on left, digital/AI transformation on right. Clean lines, professional look.',
  'Dark background with glowing neon accent lines forming abstract tech patterns. Title centered in bold white.',
  'Grid layout showing 4 snapshots of agency workflow being automated. Clean overlay with gradient title bar.',
  'Single powerful statement on clean background with subtle tech pattern watermark. Minimal, premium feel.',
]

const B_ROLL_TEMPLATES = [
  'Close-up of hands typing on laptop with holographic data projections floating above keyboard',
  'Smooth drone shot of modern office with digital transformation overlays on glass windows',
  'Timelapse of dashboard data flowing — charts updating, metrics changing, automated systems running',
  'Shot of AI interface responding to voice commands — text appearing on screen as person speaks',
  'Slow motion of team collaborating with tablet showing AI analytics overlay',
  'Abstract visualization of data flowing through neural network with glowing nodes',
  'Person walking through futuristic office with digital data streams flowing past them',
  'Close-up of robot/AI hand meeting human hand in dramatic lighting',
  'Aerial view of server racks with pulsing blue lights indicating AI processing',
  'Shot of smartphone showing AI app with user tapping and watching automation happen',
]

export class CreativeFactory {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  async processPackage(pkg: ReelPackage): Promise<CreativeFactoryResult> {
    const startTime = Date.now()
    const errors: string[] = []

    // 1. Get the DB reel_package record
    const { data: reelPackage } = await this.supabase
      .from('reel_packages')
      .select('id')
      .eq('user_id', this.userId)
      .eq('title', pkg.title)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const packageId = reelPackage?.id || ''

    // 2. Generate Thumbnail Prompt
    const thumbnail = this.generateThumbnailPrompt(pkg)
    await this.storePrompt(packageId, 'thumbnail', thumbnail.prompt, `Thumbnail for "${pkg.title}"`)

    // 3. Generate Cover Image Prompt
    const coverPrompt = this.generateCoverPrompt(pkg)
    await this.storePrompt(packageId, 'cover', coverPrompt, `Cover for "${pkg.title}"`)

    // 4. Generate Carousel Image Prompts (one per scene)
    const carouselPrompts = pkg.visualPrompts.map((vp: VisualPrompt, i: number) => {
      const prompt = `Scene ${i+1}/${pkg.visualPrompts.length}: ${vp.prompt}. Style: ${vp.style}. Aspect ratio: ${vp.aspectRatio}. Professional quality, photorealistic, 8K.`
      this.storePrompt(packageId, 'carousel_slide', prompt, `Carousel slide ${i+1} for "${pkg.title}"`)
      return prompt
    })

    // 5. Generate B-Roll Prompt Pack
    const bRollCount = pkg.durationSeconds === 15 ? 3 : pkg.durationSeconds === 30 ? 5 : 8
    const bRollPack = B_ROLL_TEMPLATES.slice(0, Math.min(bRollCount, B_ROLL_TEMPLATES.length)).map((t, i) => {
      const prompt = t.replace(/\{topic\}/g, pkg.topic).replace(/\{hook\}/g, pkg.hook)
      this.storePrompt(packageId, 'b_roll', prompt, `B-roll ${i+1} for "${pkg.title}"`)
      return prompt
    })

    // 6. Queue all for image generation
    let queueJobs = 0
    const allAssets = [
      { type: 'thumbnail' as const, prompt: thumbnail.prompt },
      { type: 'cover' as const, prompt: coverPrompt },
      ...carouselPrompts.map((p: string) => ({ type: 'carousel_slide' as const, prompt: p })),
      ...bRollPack.map((p: string) => ({ type: 'b_roll' as const, prompt: p })),
    ]

    for (const asset of allAssets) {
      try {
        // Create asset record
        const { data: assetRecord } = await this.supabase.from('creative_assets').insert([{
          user_id: this.userId,
          reel_package_id: packageId || null,
          asset_type: asset.type,
          prompt: asset.prompt,
          enhanced_prompt: this.enhancePrompt(asset.prompt),
          negative_prompt: 'blurry, low quality, distorted, watermark, text errors, ugly, deformed',
          style: 'photorealistic, cinematic, 8K, professional lighting',
          aspect_ratio: asset.type === 'carousel_slide' ? '1:1' : '9:16',
          status: 'pending',
        }]).select('id').single()

        if (assetRecord?.id) {
          // Queue for generation
          await this.supabase.from('creative_generation_queue').insert([{
            user_id: this.userId,
            asset_id: assetRecord.id,
            prompt: asset.prompt,
            model: 'dall-e-3',
            status: 'queued',
            priority: asset.type === 'thumbnail' ? 1 : asset.type === 'cover' ? 2 : 3,
          }])
          queueJobs++
        }
      } catch (e: any) {
        errors.push(`Failed to queue ${asset.type}: ${e.message}`)
      }
    }

    const durationMs = Date.now() - startTime

    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null,
      action: '[CreativeFactory] Package processed',
      module: 'content', status: errors.length > 0 ? 'failed' : 'success',
      message: `"${pkg.title}": ${allAssets.length} assets, ${queueJobs} queued, ${errors.length} errors in ${(durationMs/1000).toFixed(1)}s`,
    }])

    return {
      reelPackageId: packageId,
      assetsCreated: allAssets.length,
      promptsGenerated: allAssets.length,
      queueJobs,
      thumbnail,
      coverPrompt,
      carouselPrompts: carouselPrompts as string[],
      bRollPack: bRollPack as string[],
      errors,
    }
  }

  private generateThumbnailPrompt(pkg: ReelPackage): ThumbnailPrompt {
    const template = THUMBNAIL_TEMPLATES[Math.floor(Math.random() * THUMBNAIL_TEMPLATES.length)]
    const text = pkg.hook.substring(0, 40)

    const prompt = `${template.concept}. Topic: ${pkg.topic}. Hook: "${pkg.hook}". Composition: ${template.composition}. Color palette: ${template.colors.join(', ')}. Mood: ${template.mood}. Text overlay: "${text}". Professional thumbnail for social media video. 9:16 vertical. Photorealistic, high contrast, social media thumbnails, click-through optimization, bold text readable at small size, vibrant colors, 8K quality, cinematic lighting.`

    return { ...template, text, prompt }
  }

  private generateCoverPrompt(pkg: ReelPackage): string {
    const template = COVER_TEMPLATES[Math.floor(Math.random() * COVER_TEMPLATES.length)]
    return template.replace(/\{topic\}/g, pkg.topic) + ` Hook: "${pkg.hook}". Professional LinkedIn/Instagram cover image. 9:16 vertical. Photorealistic, high quality, social media optimized, 8K.`
  }

  private storePrompt(packageId: string, type: string, promptText: string, name: string) {
    void this.supabase.from('creative_prompts').insert([{
      user_id: this.userId,
      reel_package_id: packageId || null,
      prompt_type: type,
      prompt_text: promptText,
      style_reference: 'photorealistic, cinematic, 8K',
      color_palette: ['#0a0a23', '#00d4ff', '#7c3aed'],
      mood: 'professional, innovative, futuristic',
      lighting: 'cinematic dramatic lighting',
      composition: 'centered with depth of field',
    }])
  }

  private enhancePrompt(prompt: string): string {
    return `${prompt}. Professional quality, photorealistic, 8K resolution, cinematic lighting, social media optimized, high contrast, vibrant colors, sharp focus, detailed, award-winning photography style.`
  }
}
