import { BaseValidator, type ValidationResult } from './types'

export class GrowthCalendarValidator extends BaseValidator {
  get slug() { return 'growth-calendar' }
  get name() { return 'Growth Calendar' }
  get category() { return 'growth' }

  async validate(): Promise<ValidationResult> {
    const start = Date.now()

    const { data: entries } = await this.supabase
      .from('growth_content_calendar')
      .select('id, platform, status, scheduled_date, posted_at, post_type')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!entries || entries.length === 0) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'warning', message: 'No growth calendar entries found',
        details: { totalEntries: 0 }, durationMs: Date.now() - start,
      }
    }

    const published = entries.filter(e => e.status === 'published')
    const scheduled = entries.filter(e => e.status === 'scheduled')

    const byPlatform: Record<string, number> = {}
    for (const e of entries) {
      byPlatform[e.platform] = (byPlatform[e.platform] || 0) + 1
    }

    return {
      slug: this.slug, name: this.name, category: this.category,
      status: entries.length > 0 ? 'working' : 'warning',
      message: `${entries.length} calendar entries — ${published.length} published, ${scheduled.length} scheduled`,
      details: {
        totalEntries: entries.length,
        publishedEntries: published.length,
        scheduledEntries: scheduled.length,
        byPlatform,
        recentEntries: entries.slice(0, 10).map(e => ({
          platform: e.platform,
          status: e.status,
          scheduledDate: e.scheduled_date,
          postedAt: e.posted_at,
          postType: e.post_type,
        })),
      },
      durationMs: Date.now() - start,
    }
  }
}

export class GrowthEngineValidator extends BaseValidator {
  get slug() { return 'growth-engine' }
  get name() { return 'Growth Engine' }
  get category() { return 'growth' }

  async validate(): Promise<ValidationResult> {
    const start = Date.now()

    const { data: logs } = await this.supabase
      .from('execution_logs')
      .select('id, action, status, message, created_at')
      .filter('action', 'ilike', '%[Growth]%')
      .order('created_at', { ascending: false })
      .limit(20)

    // Check for growth-related content in content_requests
    const { data: leads } = await this.supabase
      .from('leads')
      .select('id, status, source')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!logs || logs.length === 0) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: leads && leads.length > 0 ? 'working' : 'warning',
        message: leads && leads.length > 0
          ? 'No growth engine logs, but leads exist in database'
          : 'No growth engine execution history found',
        details: { totalLeads: leads?.length || 0, engineLogs: [] },
        durationMs: Date.now() - start,
      }
    }

    return {
      slug: this.slug, name: this.name, category: this.category,
      status: 'working',
      message: `Growth engine ran ${logs.length} times — ${leads?.length || 0} leads tracked`,
      details: {
        recentLogs: logs.slice(0, 10).map(l => ({
          id: l.id,
          action: l.action,
          status: l.status,
          message: l.message?.substring(0, 120),
          createdAt: l.created_at,
        })),
        totalLeads: leads?.length || 0,
      },
      durationMs: Date.now() - start,
    }
  }
}
