import type { SupabaseClient } from '@supabase/supabase-js'

export type TrendSource = 'google_trends' | 'youtube' | 'linkedin' | 'x' | 'reddit' | 'industry_news'
export type HookType = 'curiosity' | 'authority' | 'problem' | 'story' | 'shock'
export type ReelDuration = 15 | 30 | 60
export type ScriptStatus = 'draft' | 'approved' | 'produced' | 'published' | 'archived'
export type VideoStatus = 'rendering' | 'ready' | 'published' | 'failed'
export type ReelCategory = 'ai' | 'automation' | 'saas' | 'marketing' | 'agency' | 'general'
export type ReelTone = 'professional' | 'casual' | 'urgent' | 'inspirational' | 'humorous'

export interface Trend {
  keyword: string
  source: TrendSource
  category: ReelCategory
  score: number
  velocity: number
  volume: number
  momentum: 'rising' | 'stable' | 'falling'
  metadata: Record<string, any>
}

export interface CompetitorPost {
  title: string
  url: string
  engagement: number
  likes: number
  comments: number
  shares: number
  format: string
  hook: string
  cta: string
}

export interface Hook {
  hookText: string
  hookType: HookType
  score: number
  source: string
  category?: string
  topics?: string[]
}

export interface Script {
  title: string
  topic: string
  category: ReelCategory
  durationSeconds: ReelDuration
  hookText: string
  hookType: HookType
  bodyText: string
  ctaText: string
  caption: string
  hashtags: string[]
  tone: ReelTone
  hookScore: number
  predictedPerformance: number
}

export interface ReelVideo {
  title: string
  durationSeconds: number
  videoUrl?: string
  thumbnailUrl?: string
  voiceoverUrl?: string
  caption: string
  hashtags: string[]
  platformStatus: Record<string, string>
}

export interface PublishResult {
  platform: string
  success: boolean
  platformPostId?: string
  platformUrl?: string
  error?: string
}

export interface AnalyticsSnapshot {
  videoId: string
  platform: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  watchTimeSeconds: number
  avgWatchPercentage: number
  engagementRate: number
}

export interface ReelsFactoryResult {
  trendsScanned: number
  hooksGenerated: number
  scriptsCreated: number
  videosProduced: number
  videosPublished: number
  analyticsCollected: number
  strategyUpdated: boolean
  errors: string[]
  summary: string
}

export abstract class BaseReelsModule {
  protected supabase: SupabaseClient
  protected userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  protected async log(action: string, message: string, status: string = 'success') {
    await this.supabase.from('execution_logs').insert([{
      user_id: this.userId,
      command_id: null,
      action: `[ReelsFactory] ${action}`,
      module: 'reels',
      status,
      message,
    }])
  }

  protected async storeBrain(category: string, content: Record<string, any>, tags: string[]) {
    await this.supabase.from('agent_memory').insert([{
      user_id: this.userId,
      agent_id: null,
      category,
      content,
      tags: ['reels_factory', ...tags],
    }])
  }
}
