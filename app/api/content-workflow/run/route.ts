import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runContentWorkflow } from '@/lib/content-factory/content-workflow'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await runContentWorkflow(supabase, user.id)

    return NextResponse.json({
      success: result.errors.length === 0,
      summary: {
        trendsUsed: result.trends.length,
        newsArticles: result.news.length,
        ideasGenerated: result.contentIdeas.length,
        contentPublished: result.publishedContent.length,
        calendarDays: result.calendarDays.length,
        awaitingApproval: result.approvalQueue.length,
        imagesFound: result.images.length,
        errors: result.errors.length,
        durationMs: result.durationMs,
      },
      approvalQueue: result.approvalQueue.map((a) => ({
        title: a.title,
        contentType: a.contentType,
        platform: a.platform,
        score: a.score,
        imageUrl: a.imageUrl,
      })),
      calendar: result.calendarDays.map((d) => ({
        date: d.date,
        dayLabel: d.dayLabel,
        items: d.items.map((i) => i.title),
      })),
      trace: result.trace.slice(-5),
      errors: result.errors,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, success: false }, { status: 500 })
  }
}
