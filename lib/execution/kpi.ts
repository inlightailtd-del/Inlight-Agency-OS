import type { SupabaseClient } from '@supabase/supabase-js'

export interface RealKPI {
  date: string
  postsPublished: number
  linkedinPosts: number
  emailsSent: number
  leadsGenerated: number
  leadsContacted: number
  meetingsBooked: number
}

/**
 * Track real KPIs by querying actual database records.
 * No mock data — every number comes from production tables.
 */
export async function trackDailyKPIs(supabase: SupabaseClient, userId: string): Promise<RealKPI> {
  const today = new Date().toISOString().split('T')[0]
  const todayStart = new Date().toISOString()
  const todayEnd = new Date(Date.now() + 86400000).toISOString()

  // Published posts today
  const { data: published } = await supabase
    .from('growth_content_calendar')
    .select('id, platform')
    .eq('user_id', userId)
    .eq('status', 'published')
    .gte('posted_at', todayStart)
  const publishedArr = (published ?? []) as any[]

  // LinkedIn-specific
  const linkedinPosts = publishedArr.filter((p: any) => p.platform === 'linkedin').length

  // Emails sent via Gmail/Outlook health logs today
  const { data: emailLogs } = await supabase
    .from('integration_health_logs')
    .select('id')
    .eq('user_id', userId)
    .in('provider', ['gmail', 'outlook'])
    .eq('event', 'action')
    .eq('status', 'success')
    .gte('created_at', todayStart)
  const emailsSent = (emailLogs ?? []).length

  // Leads generated today
  const { data: leadsToday } = await supabase
    .from('growth_leads')
    .select('id, contacted')
    .eq('user_id', userId)
    .gte('created_at', todayStart)
  const leadsArr = (leadsToday ?? []) as any[]

  // Meetings booked
  const { data: meetings } = await supabase
    .from('appointments')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', todayStart)

  return {
    date: today,
    postsPublished: publishedArr.length,
    linkedinPosts,
    emailsSent,
    leadsGenerated: leadsArr.length,
    leadsContacted: leadsArr.filter((l: any) => l.contacted).length,
    meetingsBooked: (meetings ?? []).length,
  }
}
