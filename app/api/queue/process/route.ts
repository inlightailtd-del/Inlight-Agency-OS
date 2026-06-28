import { createClient } from '@/lib/supabase/server'
import { processNextJob } from '@/lib/queue/worker'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const cronSecret = req.headers.get('x-cron-secret')
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = await createClient()
    const result = await processNextJob(supabase)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ processed: false, error: err.message }, { status: 500 })
  }
}
