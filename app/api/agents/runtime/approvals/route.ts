import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchPendingApprovals } from '@/lib/agents/approval'

/**
 * GET /api/agents/runtime/approvals
 * List all pending approval requests.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const approvals = await fetchPendingApprovals(supabase, user.id)
    return NextResponse.json({ approvals })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
