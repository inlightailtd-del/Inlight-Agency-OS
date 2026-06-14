import type { SupabaseClient } from '@supabase/supabase-js'
import { ContentIdeaGenerator } from './idea-generator'
import { PostWriter, CarouselCreator, ReelScriptWriter } from './writers'
import { PublishingQueue, ContentAnalytics, ContentLearning } from './publishing'
import { type ContentFactoryResult } from './types'

export async function runFullContentFactory(
  supabase: SupabaseClient,
  userId: string
): Promise<ContentFactoryResult> {
  const startTime = Date.now()
  const errors: string[] = []

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: '[ContentFactory] Factory cycle started', module: 'content',
    status: 'running', message: 'Full content production pipeline',
  }])

  // Phase 1: Generate ideas from real market trends
  let ideas: any[] = []
  try {
    const generator = new ContentIdeaGenerator(supabase, userId)
    ideas = await generator.generate(12)
  } catch (e: any) { errors.push(`Ideas: ${e.message}`) }

  // Phase 2: Write LinkedIn posts
  let posts: any[] = []
  try {
    const writer = new PostWriter(supabase, userId)
    posts = await writer.writePosts(ideas, 5)
  } catch (e: any) { errors.push(`Posts: ${e.message}`) }

  // Phase 3: Create carousel concepts
  let carousels: any[] = []
  try {
    const creator = new CarouselCreator(supabase, userId)
    carousels = await creator.createCarousels(ideas, 5)
  } catch (e: any) { errors.push(`Carousels: ${e.message}`) }

  // Phase 4: Write reel scripts
  let reels: any[] = []
  try {
    const writer = new ReelScriptWriter(supabase, userId)
    reels = await writer.writeReelScripts(ideas, 3)
  } catch (e: any) { errors.push(`Reels: ${e.message}`) }

  // Phase 5: Publish to LinkedIn
  let calendarPublished = 0
  let weeklyPlanCreated = false
  try {
    const queue = new PublishingQueue(supabase, userId)

    // Create weekly plan
    const allContent = [...posts, ...carousels, ...reels]
    await queue.createWeeklyPlan(allContent)
    weeklyPlanCreated = true

    // Publish posts (only if they haven't been published yet)
    const publishable = posts.filter(p => p.contentType === 'post')
    if (publishable.length > 0) {
      const result = await queue.publish(publishable)
      calendarPublished = result.published
    }
  } catch (e: any) { errors.push(`Publishing: ${e.message}`) }

  // Phase 6: Collect analytics
  let analyticsCollected = 0
  try {
    const analytics = new ContentAnalytics(supabase, userId)
    analyticsCollected = await analytics.collectAnalytics()
  } catch (e: any) { errors.push(`Analytics: ${e.message}`) }

  // Phase 7: Learning
  try {
    const learning = new ContentLearning(supabase, userId)
    await learning.learn([...posts, ...carousels, ...reels])
  } catch (e: any) { errors.push(`Learning: ${e.message}`) }

  const durationMs = Date.now() - startTime

  const summary = [
    `Ideas: ${ideas.length}`,
    `Posts: ${posts.length}`,
    `Carousels: ${carousels.length}`,
    `Reels: ${reels.length}`,
    `Published: ${calendarPublished}`,
    `Analytics: ${analyticsCollected}`,
    `Plan: ${weeklyPlanCreated ? '✓' : '✗'}`,
    `Errors: ${errors.length}`,
    `${(durationMs / 1000).toFixed(1)}s`,
  ].join(' | ')

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: '[ContentFactory] Factory cycle completed', module: 'content',
    status: errors.length > 0 ? 'failed' : 'success', message: summary,
  }])

  return {
    ideasGenerated: ideas.length,
    postsCreated: posts.length,
    carouselsCreated: carousels.length,
    reelsCreated: reels.length,
    calendarPublished,
    analyticsCollected,
    weeklyPlanCreated,
    errors,
    summary,
  }
}
