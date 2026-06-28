import type { SupabaseClient } from '@supabase/supabase-js'
import type { SwarmSharedMemory, MemorySubscription } from './types'

export class SharedMemorySystem {
  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  async write(
    key: string,
    value: Record<string, any>,
    opts?: {
      agentId?: string
      department?: string
      tags?: string[]
      overwrite?: boolean
    }
  ): Promise<SwarmSharedMemory | { conflict: true; existing: SwarmSharedMemory }> {
    const existing = await this.read(key)

    if (existing && !opts?.overwrite) {
      return { conflict: true, existing }
    }

    const now = new Date().toISOString()
    const nextVersion = existing ? existing.version + 1 : 1

    const { data, error } = await this.supabase.from('swarm_shared_memory').upsert({
      user_id: this.userId,
      key,
      value,
      writer_agent_id: opts?.agentId ?? null,
      department: opts?.department ?? null,
      tags: opts?.tags ?? [],
      version: nextVersion,
      conflict_resolved: false,
      updated_at: now,
    }, { onConflict: 'user_id,key' }).select('*').single()

    if (error) throw new Error(`Failed to write shared memory: ${error.message}`)
    return data as SwarmSharedMemory
  }

  async read(key: string): Promise<SwarmSharedMemory | null> {
    const { data } = await this.supabase
      .from('swarm_shared_memory')
      .select('*')
      .eq('user_id', this.userId)
      .eq('key', key)
      .single()
    return (data ?? null) as SwarmSharedMemory | null
  }

  async search(opts: {
    tags?: string[]
    department?: string
    query?: string
    limit?: number
  }): Promise<SwarmSharedMemory[]> {
    let q = this.supabase
      .from('swarm_shared_memory')
      .select('*')
      .eq('user_id', this.userId)
      .order('updated_at', { ascending: false })
      .limit(opts.limit ?? 50)

    if (opts.tags?.length) {
      q = q.contains('tags', opts.tags)
    }
    if (opts.department) {
      q = q.eq('department', opts.department)
    }

    const { data } = await q
    let results = (data ?? []) as SwarmSharedMemory[]

    if (opts.query) {
      const lower = opts.query.toLowerCase()
      results = results.filter(
        (m) => m.key.toLowerCase().includes(lower) ||
          JSON.stringify(m.value).toLowerCase().includes(lower)
      )
    }

    return results
  }

  async getContext(
    keys: string[]
  ): Promise<string> {
    const memories: string[] = []
    for (const key of keys) {
      const mem = await this.read(key)
      if (mem) {
        memories.push(`[${key}]: ${JSON.stringify(mem.value, null, 2)}`)
      }
    }
    return memories.join('\n\n')
  }

  async delete(key: string): Promise<void> {
    await this.supabase
      .from('swarm_shared_memory')
      .delete()
      .eq('user_id', this.userId)
      .eq('key', key)
  }

  async markResolved(key: string): Promise<void> {
    await this.supabase
      .from('swarm_shared_memory')
      .update({ conflict_resolved: true, updated_at: new Date().toISOString() })
      .eq('user_id', this.userId)
      .eq('key', key)
  }

  subscribe(_subscription: MemorySubscription): void {
    // In-memory subscription tracking — for future real-time integration
    // this.subscriptions.push(subscription)
  }
}
