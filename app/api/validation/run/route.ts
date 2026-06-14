import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runFullProductionAudit } from '@/lib/validation'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const report = await runFullProductionAudit(supabase, user.id)

    return NextResponse.json(report)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
