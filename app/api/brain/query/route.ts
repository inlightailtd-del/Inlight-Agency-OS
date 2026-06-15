/**
 * Company Brain V2 — API endpoint for agents to query the brain.
 * POST /api/brain/query
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { queryBrain, formatContextBlock } from '@/lib/brain/context'
import { storeMemories, indexKnowledgeDoc } from '@/lib/brain/embeddings'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    // Route by action type
    switch (body.action) {
      case 'search': {
        const ctx = await queryBrain(supabase, user.id, body.query, {
          maxVector: body.maxResults ?? 5,
          includeRecentMemory: body.includeMemory !== false,
        })
        return NextResponse.json({ ok: true, context: ctx })
      }

      case 'format': {
        const block = await formatContextBlock(supabase, user.id, body.query)
        return NextResponse.json({ ok: true, contextBlock: block })
      }

      case 'store': {
        await storeMemories(supabase, user.id, [{
          content: body.content,
          memoryType: body.memoryType ?? 'knowledge',
          entityType: body.entityType,
          entityId: body.entityId,
          importance: body.importance ?? 5,
          metadata: body.metadata ?? {},
        }])
        return NextResponse.json({ ok: true })
      }

      case 'index_doc': {
        await indexKnowledgeDoc(supabase, user.id, {
          id: body.docId,
          title: body.title,
          content: body.content,
          category: body.category ?? 'general',
          tags: body.tags ?? [],
        })
        return NextResponse.json({ ok: true })
      }

      default:
        return NextResponse.json({ error: 'Unknown action. Use: search, format, store, index_doc' }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
