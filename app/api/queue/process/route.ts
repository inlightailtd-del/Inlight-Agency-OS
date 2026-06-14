import { createClient } from '@/lib/supabase/server'
import { processNextJob } from '@/lib/queue/worker'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const result = await processNextJob(supabase)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ processed: false, error: err.message }, { status: 500 })
  }
}
