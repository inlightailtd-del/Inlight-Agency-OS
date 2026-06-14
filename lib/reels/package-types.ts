import type { SupabaseClient } from '@supabase/supabase-js'

export interface SceneBreakdown {
  sceneNumber: number
  timing: string
  durationSec: number
  visual: string
  onScreenText: string
  voiceoverLine: string
  cameraDirection: string
}

export interface VisualPrompt {
  sceneNumber: number
  prompt: string
  style: string
  aspectRatio: string
}

export interface ReelPackage {
  title: string
  topic: string
  durationSeconds: 15 | 30 | 60
  trendSource: string
  trendKeyword: string
  trendCategory: string
  hook: string
  hookType: string
  hookScore: number
  scriptBody: string
  storyboard: { scene: number; visual: string; text: string; timing: string }[]
  scenes: SceneBreakdown[]
  visualPrompts: VisualPrompt[]
  voiceoverText: string
  caption: string
  hashtags: string[]
  cta: string
  predictedPerformance: number
}

export interface ReelPackageResult {
  packagesCreated: number
  totalDuration: string
  packages: ReelPackage[]
  errors: string[]
}

export abstract class BaseReelPackageModule {
  protected supabase: SupabaseClient
  protected userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  protected async log(action: string, message: string, status = 'success') {
    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId, command_id: null,
      action: `[ReelPackage] ${action}`, module: 'reels', status, message,
    }])
  }

  protected async storeBrain(category: string, content: Record<string, any>, tags: string[]) {
    await this.supabase.from('agent_memory').insert([{
      user_id: this.userId, agent_id: null,
      category, content, tags: ['reel-package', ...tags],
    }])
  }
}
