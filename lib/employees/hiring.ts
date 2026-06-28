import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { setCompensation } from './compensation'
import { DEPARTMENT_SPECIALIZATIONS, PROMOTION_THRESHOLDS, type OnboardingStep } from './types'

export interface HiringProfile {
  name: string
  skills: string[]
  personality: string
  strengths: string[]
  weaknesses: string[]
  suggestedRole: string
  estimatedProductivity: number
}

export async function generateHiringProfile(
  supabase: SupabaseClient,
  userId: string,
  department: string,
  specialization: string
): Promise<HiringProfile> {
  const systemPrompt = `You are an HR AI specializing in AI agent recruitment. Generate a detailed employee profile.
Return JSON: {"name": "professional name", "skills": ["3-5 relevant skills"], "personality": "brief description (max 20 words)", "strengths": ["2-3 strengths"], "weaknesses": ["1-2 weaknesses"], "suggestedRole": "specific role title", "estimatedProductivity": 0-100}`
  const result = await executeAgentTask(supabase, userId, null,
    `Create a ${specialization} specialist profile for the ${department} department. The team needs someone who can handle ${specialization} tasks effectively.`, { systemPrompt }
  )

  let profile: HiringProfile = {
    name: `${specialization} Agent`, skills: [specialization],
    personality: '', strengths: [], weaknesses: [],
    suggestedRole: `${specialization} Specialist`, estimatedProductivity: 60,
  }
  try { profile = JSON.parse(result.response || '{}') } catch {}
  return profile
}

export async function hireEmployee(
  supabase: SupabaseClient,
  userId: string,
  department: string,
  specialization: string
): Promise<string> {
  const profile = await generateHiringProfile(supabase, userId, department, specialization)
  const typeMap: Record<string, string> = {
    sales: 'sales', marketing: 'marketing', content: 'content',
    operations: 'automation', finance: 'finance', development: 'developer',
    design: 'general', hr: 'general',
  }

  const onBoarding = generateOnboardingPlan(department, specialization)

  const { data: agent } = await supabase.from('agents').insert([{
    user_id: userId, name: profile.name,
    type: typeMap[department] || 'general',
    role: profile.suggestedRole || `${specialization} Specialist`,
    department, status: 'onboarding',
    skills: profile.skills || [specialization],
    specialization,
    performance_score: 50, success_rate: 50,
    total_executions: 0, tasks_completed: 0,
    level: 1, training_count: 0,
    hired_at: new Date().toISOString(),
    config: {
      hiringProfile: profile,
      onboarding: onBoarding,
      compensation: null,
      hiredAt: new Date().toISOString(),
    },
  }]).select('id').single()

  const agentId = agent?.id || ''
  if (!agentId) throw new Error('Failed to create employee')

  await setCompensation(supabase, userId, agentId, department, 1)
  await storeMemory(supabase, userId, {
    category: 'employee_learning', tags: [department, 'hiring', 'new_hire', specialization],
    content: { type: 'hiring', employeeName: profile.name, department, specialization, skills: profile.skills, strengths: profile.strengths, weaknesses: profile.weaknesses, estimatedProductivity: profile.estimatedProductivity, hiredAt: new Date().toISOString() },
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: `[Hiring] Hired ${profile.name} as ${profile.suggestedRole} for ${department}`,
    module: department, status: 'success',
    message: `Specialization: ${specialization}, Skills: ${(profile.skills || []).join(', ')}, Est. Productivity: ${profile.estimatedProductivity}`,
    entity_type: 'agent', entity_id: agentId,
  }])

  return agentId
}

export async function completeOnboarding(
  supabase: SupabaseClient,
  userId: string,
  agentId: string
): Promise<void> {
  const { data: agent } = await supabase.from('agents').select('*').eq('id', agentId).single()
  if (!agent) throw new Error('Employee not found')

  const onboarding = (agent as any).config?.onboarding as OnboardingStep[] || []
  const allCompleted = onboarding.length === 0 || onboarding.every((s: OnboardingStep) => s.completed)

  if (allCompleted) {
    await supabase.from('agents').update({
      status: 'active', updated_at: new Date().toISOString(),
      config: { ...((agent as any).config || {}), onboardingCompletedAt: new Date().toISOString() },
    }).eq('id', agentId)

    await supabase.from('execution_logs').insert([{
      user_id: userId, command_id: null,
      action: `[Hiring] ${(agent as any).name} completed onboarding`,
      module: (agent as any).department || 'general', status: 'success',
      entity_type: 'agent', entity_id: agentId,
    }])
  } else {
    const incomplete = onboarding.filter(s => !s.completed)
    await supabase.from('execution_logs').insert([{
      user_id: userId, command_id: null,
      action: `[Hiring] Onboarding incomplete for ${(agent as any).name}`,
      module: (agent as any).department || 'general', status: 'info',
      message: `Remaining steps: ${incomplete.map(s => s.step).join(', ')}`,
      entity_type: 'agent', entity_id: agentId,
    }])
  }
}

export async function getOnboardingStatus(
  supabase: SupabaseClient,
  userId: string,
  agentId: string
): Promise<{ steps: OnboardingStep[]; completed: boolean; percentComplete: number }> {
  const { data: agent } = await supabase.from('agents').select('config').eq('id', agentId).single()
  if (!agent) throw new Error('Employee not found')

  const steps = ((agent as any).config?.onboarding || []) as OnboardingStep[]
  const completedCount = steps.filter(s => s.completed).length
  return {
    steps,
    completed: steps.length > 0 && steps.every(s => s.completed),
    percentComplete: steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0,
  }
}

function generateOnboardingPlan(department: string, specialization: string): OnboardingStep[] {
  return [
    { step: 'Company Orientation', description: 'Introduction to agency structure, mission, and values', completed: false, completedAt: null },
    { step: 'Department Introduction', description: `Meet the ${department} team and understand workflows`, completed: false, completedAt: null },
    { step: `Tool Setup - ${specialization}`, description: `Configure tools and access for ${specialization} work`, completed: false, completedAt: null },
    { step: 'First Task Assignment', description: 'Receive and complete first supervised task', completed: false, completedAt: null },
    { step: 'Performance Baseline', description: 'Establish initial performance metrics and goals', completed: false, completedAt: null },
  ]
}
