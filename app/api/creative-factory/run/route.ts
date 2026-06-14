import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { runCreativeFactory } = await import('@/lib/content-factory/creative-index')
    const supabase = await createClient()

    // Support Authorization header for non-cookie clients
    const authHeader = request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data: { user } } = await supabase.auth.getUser(token)
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const result = await runCreativeFactory(supabase, user.id)
      return NextResponse.json(result)
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await runCreativeFactory(supabase, user.id)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
