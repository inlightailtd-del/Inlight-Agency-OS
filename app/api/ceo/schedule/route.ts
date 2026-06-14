import { createClient } from '@/lib/supabase/server'
import { enqueueCeoAssessmentIfNeeded } from '@/lib/ceo/scheduler'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const result = await enqueueCeoAssessmentIfNeeded(supabase, user.id)

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
