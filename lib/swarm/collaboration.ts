import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SwarmCollaboration, SwarmCollabTask, SwarmParticipant,
  CollaborationStatus, SwarmRound,
} from './types'
import { SharedMemorySystem } from './shared-memory'
import { ConflictResolutionEngine } from './conflict-resolution'

export class CrossDepartmentCollaboration {
  private sharedMemory: SharedMemorySystem
  private conflictEngine: ConflictResolutionEngine

  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {
    this.sharedMemory = new SharedMemorySystem(supabase, userId)
    this.conflictEngine = new ConflictResolutionEngine(supabase, userId)
  }

  async createProject(params: {
    title: string
    description?: string
    departments: string[]
    leadAgentId?: string
    milestones?: { title: string; dueAt?: string }[]
  }): Promise<SwarmCollaboration> {
    const { data, error } = await this.supabase.from('swarm_collaborations').insert([{
      user_id: this.userId,
      title: params.title,
      description: params.description ?? null,
      departments: params.departments,
      lead_agent_id: params.leadAgentId ?? null,
      status: 'active',
      progress: 0,
      milestones: JSON.stringify(params.milestones ?? []),
    }]).select('*').single()

    if (error) throw new Error(`Failed to create collaboration: ${error.message}`)

    const collab = data as SwarmCollaboration
    await this.sharedMemory.write(`collaboration:${collab.id}`, {
      title: collab.title,
      departments: collab.departments,
      leadAgentId: params.leadAgentId,
      status: 'active',
      progress: 0,
      milestones: params.milestones ?? [],
    }, { tags: ['collaboration', ...collab.departments], overwrite: true })

    return collab
  }

  async addTask(
    collaborationId: string,
    task: {
      agentId?: string
      department?: string
      title: string
      description?: string
      priority?: string
      dependsOn?: string[]
    }
  ): Promise<SwarmCollabTask> {
    const { data, error } = await this.supabase.from('swarm_collaboration_tasks').insert([{
      collaboration_id: collaborationId,
      agent_id: task.agentId ?? null,
      department: task.department ?? null,
      title: task.title,
      description: task.description ?? null,
      status: 'pending',
      priority: task.priority ?? 'medium',
      depends_on: task.dependsOn ?? [],
    }]).select('*').single()

    if (error) throw new Error(`Failed to add task: ${error.message}`)
    return data as SwarmCollabTask
  }

  async updateTaskStatus(
    taskId: string,
    status: SwarmCollabTask['status'],
    output?: string
  ): Promise<void> {
    const update: Record<string, any> = { status, updated_at: new Date().toISOString() }
    if (output) update.output = output
    if (status === 'in_progress') update.started_at = new Date().toISOString()
    if (status === 'completed') update.completed_at = new Date().toISOString()

    await this.supabase.from('swarm_collaboration_tasks').update(update).eq('id', taskId)
  }

  async getNextTasks(
    collaborationId: string,
    agentId: string
  ): Promise<SwarmCollabTask[]> {
    const { data: allTasks } = await this.supabase
      .from('swarm_collaboration_tasks')
      .select('*')
      .eq('collaboration_id', collaborationId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })

    const tasks = (allTasks ?? []) as SwarmCollabTask[]
    const completedIds = new Set(
      tasks.filter((t) => t.status === 'completed').map((t) => t.id)
    )

    return tasks.filter((t) => {
      if (t.status !== 'pending') return false
      if (t.agent_id && t.agent_id !== agentId) return false
      return t.depends_on.every((d) => completedIds.has(d))
    })
  }

  async updateProgress(
    collaborationId: string
  ): Promise<number> {
    const { data: tasks } = await this.supabase
      .from('swarm_collaboration_tasks')
      .select('status')
      .eq('collaboration_id', collaborationId)

    const list = (tasks ?? []) as { status: string }[]
    if (list.length === 0) return 0

    const completed = list.filter((t) => t.status === 'completed').length
    const progress = Math.round((completed / list.length) * 100)

    await this.supabase.from('swarm_collaborations').update({
      progress,
      updated_at: new Date().toISOString(),
    }).eq('id', collaborationId)

    if (progress >= 100) {
      await this.completeProject(collaborationId)
    }

    return progress
  }

  private async completeProject(collaborationId: string): Promise<void> {
    const now = new Date().toISOString()
    await this.supabase.from('swarm_collaborations').update({
      status: 'completed',
      progress: 100,
      completed_at: now,
      updated_at: now,
    }).eq('id', collaborationId)
  }

  async orchestrateCrossDeptWorkflow(
    round: SwarmRound,
    participants: SwarmParticipant[],
    collaborationId: string
  ): Promise<{
    tasksProcessed: number
    conflictsDetected: number
    progress: number
  }> {
    const depts = new Set(participants.map((p) => p.department).filter(Boolean))
    let tasksProcessed = 0
    let conflictsDetected = 0

    for (const dept of depts) {
      const deptParticipants = participants.filter((p) => p.department === dept)

      for (const p of deptParticipants) {
        const nextTasks = await this.getNextTasks(collaborationId, p.agent_id)

        for (const task of nextTasks) {
          const existingConflict = await this.conflictEngine.getOpenConflicts(round.id)
          const hasConflict = existingConflict.some((c) =>
            c.agents_involved.includes(p.agent_id)
          )

          if (hasConflict) {
            conflictsDetected++
            continue
          }

          await this.updateTaskStatus(task.id, 'in_progress')
          tasksProcessed++
        }
      }
    }

    const progress = await this.updateProgress(collaborationId)
    return { tasksProcessed, conflictsDetected, progress }
  }
}
