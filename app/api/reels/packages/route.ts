import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runReelPackageFactory } from '@/lib/reels/package-index'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await runReelPackageFactory(supabase, user.id, 3)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
