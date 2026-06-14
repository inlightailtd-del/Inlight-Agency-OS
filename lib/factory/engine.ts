import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { enqueueJob, fetchJobs } from '@/lib/queue/queue'

const DEPARTMENT_SPECIALIZATIONS: Record<string, string[]> = {
  sales: ['lead_generation', 'outreach', 'proposal_writing', 'client_communication'],
  marketing: ['content_marketing', 'social_media', 'seo', 'campaign_management'],
  content: ['blog_writing', 'copywriting', 'editing', 'content_strategy'],
  operations: ['workflow_automation', 'project_management', 'quality_assurance'],
  finance: ['invoicing', 'expense_tracking', 'financial_reporting'],
}

export interface HiringNeed {
  department: string
  reason: string
  priority: number
  suggestedSpecialization: string
}

export interface FactoryReport {
  hired: number
  trained: number
  promoted: number
  retired: number
  needs: HiringNeed[]
  summary: string
}

export async function analyzeWorkforceNeeds(supabase: SupabaseClient, userId: string): Promise<HiringNeed[]> {
  const { data: agents } = await supabase.from('agents').select('*').eq('user_id', userId)
  const allAgents = (agents ?? []) as any[]

  const jobs = await fetchJobs(supabase, userId)
  const pendingJobs = jobs.filter((j) => j.status === 'pending')

  const { data: tasks } = await supabase.from('orchestrator_tasks').select('*').eq('user_id', userId).eq('status', 'pending')
  const pendingTasks = (tasks ?? []) as any[]

  const needs: HiringNeed[] = []

  // Check each department for workload imbalance
  const deptAgents: Record<string, any[]> = {}
  for (const a of allAgents) {
    const dept = a.department || 'general'
    if (!deptAgents[dept]) deptAgents[dept] = []
    deptAgents[dept].push(a)
  }

  for (const [dept, members] of Object.entries(deptAgents)) {
    const activeMembers = members.filter((m: any) => m.status === 'active' || m.status === 'idle')
    const avgPerformance = members.length > 0
      ? Math.round(members.reduce((s: number, m: any) => s + (m.performance_score || 0), 0) / members.length)
      : 0

    if (activeMembers.length === 0 && members.length > 0) {
      needs.push({ department: dept, reason: `All ${dept} employees are offline/busy`, priority: 8, suggestedSpecialization: '' })
    }

    if (avgPerformance < 40 && members.length >= 2) {
      needs.push({ department: dept, reason: `Low avg performance (${avgPerformance}%) in ${dept}`, priority: 6, suggestedSpecialization: '' })
    }
  }

  // Check if pending workload suggests hiring need
  if (pendingJobs.length > 20) {
    needs.push({ department: 'operations', reason: `${pendingJobs.length} pending queue jobs`, priority: 7, suggestedSpecialization: 'workflow_automation' })
  }

  if (pendingTasks.length > 15) {
    needs.push({ department: 'operations', reason: `${pendingTasks.length} pending tasks`, priority: 6, suggestedSpecialization: 'project_management' })
  }

  // If no needs detected, return general recommendation
  if (needs.length === 0) {
    const smallestDept = Object.entries(deptAgents).sort(([, a], [, b]) => a.length - b.length)[0]
    if (smallestDept) {
      needs.push({
        department: smallestDept[0],
        reason: `${smallestDept[0]} has only ${smallestDept[1].length} employee(s)`,
        priority: 4,
        suggestedSpecialization: DEPARTMENT_SPECIALIZATIONS[smallestDept[0]]?.[0] || 'general',
      })
    }
  }

  return needs.sort((a, b) => b.priority - a.priority)
}

export async function hireEmployee(
  supabase: SupabaseClient,
  userId: string,
  department: string,
  specialization: string
): Promise<string> {
  const systemPrompt = `You are an HR AI. Generate a new AI employee profile.
Return JSON: {"name": "professional name", "skills": ["skill1", "skill2"], "personality": "brief description"}`

  const result = await executeAgentTask(supabase, userId, null,
    `Create a ${specialization} specialist for ${department} department.`,
    { systemPrompt }
  )

  let profile: any = { name: `${specialization} Agent`, skills: [], personality: '' }
  try { profile = JSON.parse(result.response || '{}') } catch { /* use defaults */ }

  const { data: agent } = await supabase.from('agents').insert([{
    user_id: userId,
    name: profile.name || `${specialization} Agent`,
    type: department === 'sales' ? 'sales' : department === 'marketing' ? 'marketing' : department === 'content' ? 'content' : department === 'finance' ? 'finance' : 'general',
    role: `${specialization} Specialist`,
    department,
    status: 'active',
    skills: profile.skills || [],
    specialization,
    performance_score: 50,
    success_rate: 50,
    total_executions: 0,
    tasks_completed: 0,
    level: 1,
    training_count: 0,
    hired_at: new Date().toISOString(),
  }]).select('id').single()

  await storeMemory(supabase, userId, {
    category: 'employee_learning',
    content: {
      type: 'hiring',
      employeeName: profile.name,
      department,
      specialization,
      skills: profile.skills,
      hiredAt: new Date().toISOString(),
    },
    tags: [department, 'hiring', 'new_hire'],
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: `[Factory] Hired ${profile.name || specialization} for ${department}`,
    module: department, status: 'success',
    message: `Specialization: ${specialization}, Skills: ${(profile.skills || []).join(', ')}`,
    entity_type: 'agent', entity_id: agent?.id,
  }])

  return agent?.id || ''
}

export async function trainEmployee(
  supabase: SupabaseClient,
  userId: string,
  agentId: string
): Promise<{ trained: boolean; newSkill?: string }> {
  const { data: agent } = await supabase.from('agents').select('*').eq('id', agentId).single()
  if (!agent) return { trained: false }

  const systemPrompt = `You are a Training AI. Suggest a new skill for this employee.
Return JSON: {"skill": "skill name", "reason": "why this skill"}`

  const result = await executeAgentTask(supabase, userId, null,
    `${agent.name} is a ${agent.role || agent.type} in ${agent.department || 'general'}. Current skills: ${(agent.skills || []).join(', ') || 'none'}`,
    { systemPrompt }
  )

  let training: any = { skill: '', reason: '' }
  try { training = JSON.parse(result.response || '{}') } catch { return { trained: false } }
  if (!training.skill) return { trained: false }

  const currentSkills = agent.skills || []
  if (currentSkills.includes(training.skill)) return { trained: false }

  currentSkills.push(training.skill)
  const newScore = Math.min(100, (agent.performance_score || 50) + 5)
  const trainingCount = (agent.training_count || 0) + 1

  await supabase.from('agents').update({
    skills: currentSkills,
    performance_score: newScore,
    training_count: trainingCount,
    last_trained_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', agentId)

  await storeMemory(supabase, userId, {
    agent_id: agentId,
    category: 'employee_learning',
    content: { type: 'training', employeeName: agent.name, newSkill: training.skill, reason: training.reason, trainedAt: new Date().toISOString() },
    tags: [agent.department || 'general', 'training'],
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: `[Factory] Trained ${agent.name} in ${training.skill}`,
    module: agent.department || 'general', status: 'success',
    message: training.reason,
    entity_type: 'agent', entity_id: agentId,
  }])

  return { trained: true, newSkill: training.skill }
}

export async function promoteRetireEmployees(supabase: SupabaseClient, userId: string): Promise<{ promoted: number; retired: number }> {
  const { data: agents } = await supabase.from('agents').select('*').eq('user_id', userId)
  const allAgents = (agents ?? []) as any[]
  let promoted = 0
  let retired = 0

  for (const agent of allAgents) {
    // Promotion logic: score > 80 and level < 5
    if (agent.performance_score >= 80 && (agent.level || 1) < 5) {
      const newLevel = (agent.level || 1) + 1
      await supabase.from('agents').update({
        level: newLevel,
        performance_score: Math.min(100, agent.performance_score + 5),
        promoted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', agent.id)
      promoted++

      await supabase.from('execution_logs').insert([{
        user_id: userId, command_id: null,
        action: `[Factory] Promoted ${agent.name} to Level ${newLevel}`,
        module: agent.department || 'general', status: 'success',
        message: `Score: ${agent.performance_score} → ${Math.min(100, agent.performance_score + 5)}`,
        entity_type: 'agent', entity_id: agent.id,
      }])
    }

    // Retirement logic: inactive > 30 days or score < 10
    const lastActive = agent.last_active_at ? new Date(agent.last_active_at).getTime() : 0
    const daysInactive = lastActive > 0 ? (Date.now() - lastActive) / (1000 * 60 * 60 * 24) : 999

    if (daysInactive > 30 || agent.performance_score < 10) {
      await supabase.from('agents').update({
        status: 'offline',
        retired_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', agent.id)
      retired++

      await supabase.from('execution_logs').insert([{
        user_id: userId, command_id: null,
        action: `[Factory] Retired ${agent.name}`,
        module: agent.department || 'general', status: 'info',
        message: daysInactive > 30 ? `Inactive ${Math.round(daysInactive)} days` : `Performance: ${agent.performance_score}%`,
        entity_type: 'agent', entity_id: agent.id,
      }])
    }
  }

  return { promoted, retired }
}

export async function runFullFactoryCycle(supabase: SupabaseClient, userId: string): Promise<FactoryReport> {
  let hired = 0
  let trained = 0

  // Analyze workforce needs
  const needs = await analyzeWorkforceNeeds(supabase, userId)

  // Hire for top 2 needs
  const topNeeds = needs.slice(0, 2)
  for (const need of topNeeds) {
    const spec = need.suggestedSpecialization || DEPARTMENT_SPECIALIZATIONS[need.department]?.[0] || 'general'
    try {
      await hireEmployee(supabase, userId, need.department, spec)
      hired++
    } catch { /* continue */ }
  }

  // Train low-performing employees
  const { data: agents } = await supabase.from('agents').select('id').eq('user_id', userId).lt('performance_score', 60).limit(5)
  const lowPerformers = (agents ?? []) as any[]
  for (const agent of lowPerformers) {
    try {
      const result = await trainEmployee(supabase, userId, agent.id)
      if (result.trained) trained++
    } catch { /* continue */ }
  }

  // Promote and retire
  const { promoted, retired } = await promoteRetireEmployees(supabase, userId)

  // Generate summary
  const systemPrompt = `Summarize this factory cycle briefly.`
  const result = await executeAgentTask(supabase, userId, null,
    `Hired: ${hired}, Trained: ${trained}, Promoted: ${promoted}, Retired: ${retired}, Needs identified: ${needs.length}`,
    { systemPrompt }
  )

  // Store in Company Brain
  await storeMemory(supabase, userId, {
    category: 'growth_pattern',
    content: { type: 'factory_cycle', hired, trained, promoted, retired, needs: needs.slice(0, 5), summary: result.response, runAt: new Date().toISOString() },
    tags: ['factory', 'growth'],
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: '[Factory] Cycle completed',
    module: 'agents', status: 'success',
    message: `Hired: ${hired}, Trained: ${trained}, Promoted: ${promoted}, Retired: ${retired}`,
  }])

  return { hired, trained, promoted, retired, needs, summary: result.response || '' }
}

export async function getFactoryStats(supabase: SupabaseClient, userId: string): Promise<{
  totalEmployees: number; avgLevel: number; avgPerformance: number; totalTraining: number; activeHires: number; retiredCount: number
}> {
  const { data: agents } = await supabase.from('agents').select('level, performance_score, training_count, status, retired_at').eq('user_id', userId)
  const allAgents = (agents ?? []) as any[]
  return {
    totalEmployees: allAgents.length,
    avgLevel: allAgents.length ? Math.round(allAgents.reduce((s, a) => s + (a.level || 1), 0) / allAgents.length) : 0,
    avgPerformance: allAgents.length ? Math.round(allAgents.reduce((s, a) => s + (a.performance_score || 0), 0) / allAgents.length) : 0,
    totalTraining: allAgents.reduce((s, a) => s + (a.training_count || 0), 0),
    activeHires: allAgents.filter((a) => a.status !== 'offline' && !a.retired_at).length,
    retiredCount: allAgents.filter((a) => a.retired_at).length,
  }
}
