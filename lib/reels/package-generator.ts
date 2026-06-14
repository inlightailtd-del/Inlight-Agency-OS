import { BaseReelPackageModule, type ReelPackage, type SceneBreakdown, type VisualPrompt, type ReelPackageResult } from './package-types'
import { TrendScanner } from './trend-scanner'
import { HookEngine } from './hook-engine'
import { ScriptEngine } from './script-engine'

const DURATIONS: (15 | 30 | 60)[] = [15, 30, 60]
const SCENE_COUNTS: Record<number, number> = { 15: 3, 30: 5, 60: 8 }

const VISUAL_STYLES = [
  'Modern tech aesthetic — dark background with neon accents, futuristic UI overlays, smooth transitions',
  'Clean corporate — white background, professional graphics, data visualization, team collaboration imagery',
  'Cinematic — dramatic lighting, depth of field, establishing shots, product or technology in action',
  'Hand-drawn / whiteboard — animated illustrations, sketch style, step-by-step transitions',
  'Split-screen — side by side comparison, before/after, dual perspective',
]

const CAMERA_DIRECTIONS = [
  'Slow push-in: camera slowly zooms in on speaker/content, creating intimacy',
  'Dynamic pan: horizontal movement following action or revealing information',
  'Jump cut: quick cuts between scenes, fast-paced energy',
  'Overlay: text or graphics floating over b-roll footage',
  'Aspect ratio shift: expands from 9:16 to full frame for emphasis',
]

export class ReelPackageGenerator extends BaseReelPackageModule {
  async generateDaily(count = 3): Promise<ReelPackageResult> {
    await this.log('Package generation started', `Generating ${count} complete reel packages`)

    // Phase 1: Get real trends
    const trendScanner = new TrendScanner(this.supabase, this.userId)
    await trendScanner.runFullScan()
    const trends = await trendScanner.getTopOpportunities(5)

    // Phase 2: Generate hooks
    const hookEngine = new HookEngine(this.supabase, this.userId)
    const hooks = await hookEngine.getTopHooks(20)
    if (hooks.length < 5) await hookEngine.generateHooks(undefined, 10)

    // Phase 3: Generate scripts
    const scriptEngine = new ScriptEngine(this.supabase, this.userId)
    const topics = trends.length > 0
      ? trends.slice(0, count).map(t => t.keyword)
      : ['AI automation', 'AI agents', 'business automation']

    const packages: ReelPackage[] = []
    const errors: string[] = []

    for (let i = 0; i < count; i++) {
      try {
        const pkg = await this.buildPackage(
          topics[i % topics.length],
          DURATIONS[i % DURATIONS.length],
          trends[i % trends.length]
        )
        packages.push(pkg)

        // Store in DB
        await this.supabase.from('reel_packages').insert([{
          user_id: this.userId,
          title: pkg.title,
          topic: pkg.topic,
          duration_seconds: pkg.durationSeconds,
          trend_source: pkg.trendSource,
          trend_keyword: pkg.trendKeyword,
          trend_category: pkg.trendCategory,
          hook: pkg.hook,
          hook_type: pkg.hookType,
          hook_score: pkg.hookScore,
          script_body: pkg.scriptBody,
          storyboard: pkg.storyboard,
          scenes: pkg.scenes,
          visual_prompts: pkg.visualPrompts,
          voiceover_text: pkg.voiceoverText,
          caption: pkg.caption,
          hashtags: pkg.hashtags,
          cta: pkg.cta,
          predicted_performance: pkg.predictedPerformance,
          status: 'draft',
        }])
      } catch (e: any) {
        errors.push(`Package ${i + 1}: ${e.message}`)
      }
    }

    const totalSec = packages.reduce((s, p) => s + p.durationSeconds, 0)
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60

    await this.log('Package generation completed',
      `${packages.length} packages created, ${mins}m${secs}s total content: ${packages.map(p => `"${p.title}" (${p.durationSeconds}s)`).join(', ')}`)

    return {
      packagesCreated: packages.length,
      totalDuration: `${mins}m ${secs}s`,
      packages,
      errors,
    }
  }

  private async buildPackage(topic: string, duration: 15 | 30 | 60, trend: any): Promise<ReelPackage> {
    const sceneCount = SCENE_COUNTS[duration]
    const hookEngine = new HookEngine(this.supabase, this.userId)
    const hooks = await hookEngine.generateHooks(topic, 5)
    const bestHook = hooks[0]

    const hookText = bestHook?.hookText || `The truth about ${topic} nobody tells you`
    const hookType = bestHook?.hookType || 'curiosity'
    const hookScore = bestHook?.score || 75

    // Build script body
    const scriptBody = this.buildScript(topic, duration)

    // Build storyboard
    const storyboard = Array.from({ length: sceneCount }, (_, i) => ({
      scene: i + 1,
      visual: i === 0 ? `${topic} concept intro` : i === sceneCount - 1 ? 'Brand logo and CTA' : `${topic} insight ${i + 1}`,
      text: i === 0 ? hookText : i === sceneCount - 1 ? `CTA: ${this.getCTA(duration)}` : this.getSceneText(topic, i, sceneCount),
      timing: this.getTiming(i, sceneCount, duration),
    }))

    // Build scene breakdowns
    const scenes: SceneBreakdown[] = Array.from({ length: sceneCount }, (_, i) => ({
      sceneNumber: i + 1,
      timing: this.getTiming(i, sceneCount, duration),
      durationSec: Math.round(duration / sceneCount),
      visual: i === 0 ? `Opening shot showing ${topic} in action — futuristic tech aesthetic, AI visualization` : i === sceneCount - 1 ? `Brand logo with CTA text overlay, contact info` : `Scene showing ${topic} application ${i} — professional setting with data visualization`,
      onScreenText: i === 0 ? hookText : i === sceneCount - 1 ? this.getCTA(duration) : this.getSceneText(topic, i, sceneCount),
      voiceoverLine: i === 0 ? hookText : this.getVoiceoverLine(topic, i, sceneCount, duration),
      cameraDirection: CAMERA_DIRECTIONS[i % CAMERA_DIRECTIONS.length],
    }))

    // Build visual prompts
    const visualPrompts: VisualPrompt[] = scenes.map((s, i) => ({
      sceneNumber: s.sceneNumber,
      prompt: s.visual,
      style: VISUAL_STYLES[i % VISUAL_STYLES.length],
      aspectRatio: '9:16 (vertical)',
    }))

    // Voiceover
    const voiceoverText = scenes.map(s => s.voiceoverLine).join(' ')

    // Caption
    const caption = `${hookText}\n\n${this.buildCaptionBody(topic)}\n\n${this.getCTA(duration)}\n\n${this.getHashtags(topic).join(' ')}`

    // CTA
    const cta = this.getCTA(duration)

    // Hashtags
    const hashtags = this.getHashtags(topic)

    return {
      title: `${topic} — ${duration}s Reel`,
      topic,
      durationSeconds: duration,
      trendSource: trend?.source || 'ai_trend_analysis',
      trendKeyword: trend?.keyword || topic,
      trendCategory: trend?.category || 'general',
      hook: hookText,
      hookType,
      hookScore,
      scriptBody,
      storyboard,
      scenes,
      visualPrompts,
      voiceoverText,
      caption,
      hashtags,
      cta,
      predictedPerformance: hookScore * (duration === 30 ? 1.1 : 1.0),
    }
  }

  private buildScript(topic: string, duration: number): string {
    const wordCount = { 15: 30, 30: 60, 60: 120 }[duration] || 60
    return `[HOOK] ${topic} is changing everything.\n\n[BODY] Here's what you need to know: ${topic} transforms how agencies operate. Traditional methods are becoming obsolete. Early adopters are seeing dramatic results.\n\n[CTA] Follow for more ${topic} insights.`
  }

  private getSceneText(topic: string, sceneIndex: number, totalScenes: number): string {
    const texts = [
      `Most agencies don't realize ${topic} can automate 80% of their workflow`,
      `${topic} eliminates manual processes and scales without headcount`,
      `Companies using ${topic} are growing 3x faster than their competitors`,
      `The cost of ignoring ${topic} is falling behind — permanently`,
      `Implementation takes weeks, not months. Results are immediate`,
      `${topic} works 24/7 without overtime or burnout`,
      `Your competitors are already using ${topic}. Are you?`,
    ]
    return texts[sceneIndex % texts.length]
  }

  private getVoiceoverLine(topic: string, sceneIndex: number, totalScenes: number, duration: number): string {
    const lines = [
      `${topic} is transforming how businesses operate. Here's the truth nobody tells you.`,
      `Traditional agencies spend 80% of their time on repetitive tasks that ${topic} can handle automatically.`,
      `The agencies adopting ${topic} are seeing 3x efficiency gains. Manual processes are becoming obsolete.`,
      `Implementation doesn't require a massive budget. Start with one workflow. Measure the results.`,
      `Your competitors are already using ${topic}. The gap between early adopters and laggards is widening every day.`,
      `The question isn't if you should adopt ${topic}. It's how fast you can start before your competitors do.`,
    ]
    return lines[sceneIndex % lines.length]
  }

  private getCTA(duration: number): string {
    const ctas = [
      'Follow @inlight_agency for daily AI insights 🚀',
      'Save this reel for your strategy session 📌',
      'Comment your thoughts below 👇',
      'Share with someone who needs to see this',
      'Book a consultation to learn more',
    ]
    return ctas[duration === 15 ? 0 : duration === 30 ? 1 : 2]
  }

  private getTiming(sceneIndex: number, totalScenes: number, duration: number): string {
    const secPerScene = duration / totalScenes
    const start = Math.round(sceneIndex * secPerScene)
    const end = Math.round((sceneIndex + 1) * secPerScene)
    return `${start}s - ${end}s`
  }

  private buildCaptionBody(topic: string): string {
    return `Here's what we've learned building AI systems for agencies:\n\n1. ${topic} eliminates 80% of repetitive work\n2. Your team focuses on strategy, not tasks\n3. Results come in weeks, not months`
  }

  private getHashtags(topic: string): string[] {
    const base = ['#AIAgency', '#Reels', '#AIAutomation', '#BusinessGrowth']
    const topicTags = topic.toLowerCase().split(' ').map(w => `#${w.charAt(0).toUpperCase() + w.slice(1)}`)
    return [...new Set([...base, ...topicTags])].slice(0, 8)
  }
}
