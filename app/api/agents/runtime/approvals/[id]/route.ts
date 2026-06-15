import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveApproval } from '@/lib/agents/approval'

/**
 * POST /api/agents/runtime/approvals/:id
 * Body: { decision: 'approved' | 'rejected', reasoning?: string }
 * Resolve a pending approval request.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    if (!body.decision || !['approved', 'rejected'].includes(body.decision)) {
      return NextResponse.json({ error: 'Invalid decision. Must be "approved" or "rejected".' }, { status: 400 })
    }

    await resolveApproval(supabase, params.id, user.id, body.decision, body.reasoning)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
