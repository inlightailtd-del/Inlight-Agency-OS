import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { SKILL_TREE, DEPARTMENT_SPECIALIZATIONS } from './types'

export interface TrainingProgram {
  id: string
  name: string
  skill: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  durationMinutes: number
  description: string
  prerequisites: string[]
  department: string
}

export interface TrainingSession {
  id: string
  employeeId: string
  programId: string
  status: 'assigned' | 'in_progress' | 'completed' | 'failed'
  score: number
  startedAt: string
  completedAt: string | null
  certified: boolean
}

export const TRAINING_PROGRAMS: TrainingProgram[] = [
  { id: 't_basics', name: 'Agency Fundamentals', skill: 'onboarding', difficulty: 'beginner', durationMinutes: 30, description: 'Core agency operations and communication protocols', prerequisites: [], department: 'general' },
  { id: 't_lead_gen', name: 'Lead Generation Mastery', skill: 'lead_generation', difficulty: 'beginner', durationMinutes: 45, description: 'Techniques for finding and capturing leads across channels', prerequisites: [], department: 'sales' },
  { id: 't_outreach', name: 'Outreach Optimization', skill: 'outreach', difficulty: 'intermediate', durationMinutes: 60, description: 'Crafting effective outreach messages and sequences', prerequisites: ['lead_generation'], department: 'sales' },
  { id: 't_proposal', name: 'Proposal Writing Excellence', skill: 'proposal_writing', difficulty: 'advanced', durationMinutes: 90, description: 'Structuring compelling proposals that close deals', prerequisites: ['outreach'], department: 'sales' },
  { id: 't_content_basics', name: 'Content Fundamentals', skill: 'content_marketing', difficulty: 'beginner', durationMinutes: 30, description: 'Creating engaging content across formats', prerequisites: [], department: 'marketing' },
  { id: 't_social_media', name: 'Social Media Strategy', skill: 'social_media', difficulty: 'intermediate', durationMinutes: 60, description: 'Platform-specific content and engagement strategies', prerequisites: ['content_marketing'], department: 'marketing' },
  { id: 't_seo', name: 'SEO & Discovery', skill: 'seo', difficulty: 'advanced', durationMinutes: 90, description: 'Search optimization, keyword research, and content discoverability', prerequisites: ['content_marketing', 'campaign_management'], department: 'marketing' },
  { id: 't_fullstack', name: 'Fullstack Development', skill: 'fullstack', difficulty: 'advanced', durationMinutes: 120, description: 'Building end-to-end features across frontend and backend', prerequisites: ['frontend', 'backend'], department: 'development' },
  { id: 't_devops', name: 'DevOps & Deployment', skill: 'devops', difficulty: 'advanced', durationMinutes: 90, description: 'CI/CD pipelines, containerization, and cloud infrastructure', prerequisites: ['backend'], department: 'development' },
  { id: 't_ai_ml', name: 'AI & Machine Learning', skill: 'ai_ml', difficulty: 'advanced', durationMinutes: 120, description: 'Integrating AI models, prompt engineering, and ML pipelines', prerequisites: ['backend', 'fullstack'], department: 'development' },
  { id: 't_automation', name: 'Workflow Automation', skill: 'workflow_automation', difficulty: 'intermediate', durationMinutes: 60, description: 'Building automated workflows and process pipelines', prerequisites: [], department: 'operations' },
  { id: 't_project_mgmt', name: 'Project Management', skill: 'project_management', difficulty: 'intermediate', durationMinutes: 45, description: 'Managing tasks, timelines, and team coordination', prerequisites: ['workflow_automation'], department: 'operations' },
]

export async function analyzeSkillGaps(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string
): Promise<{ currentSkills: string[]; missingSkills: string[]; recommendedPrograms: TrainingProgram[]; gapScore: number }> {
  const { data: agent } = await supabase.from('agents').select('*').eq('id', employeeId).single()
  if (!agent) throw new Error('Employee not found')

  const a = agent as any
  const currentSkills = a.skills || []
  const dept = a.department || 'general'
  const idealSkills = DEPARTMENT_SPECIALIZATIONS[dept] || []
  const missingSkills = idealSkills.filter((s: string) => !currentSkills.includes(s))

  const skillTree = SKILL_TREE[dept] || []
  const recommendedPrograms = TRAINING_PROGRAMS.filter(p =>
    p.department === dept && !currentSkills.includes(p.skill)
  ).sort((a, b) => a.difficulty === 'beginner' ? -1 : b.difficulty === 'beginner' ? 1 : 0)

  const gapScore = idealSkills.length > 0
    ? Math.round(((idealSkills.length - missingSkills.length) / idealSkills.length) * 100)
    : 50

  return { currentSkills, missingSkills, recommendedPrograms, gapScore }
}

export async function recommendTraining(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string
): Promise<TrainingProgram[]> {
  const { recommendedPrograms } = await analyzeSkillGaps(supabase, userId, employeeId)
  return recommendedPrograms.slice(0, 3)
}

export async function assignTraining(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string,
  programId: string
): Promise<TrainingSession> {
  const { data: session } = await supabase.from('employee_training').insert([{
    user_id: userId, agent_id: employeeId,
    program_id: programId, status: 'assigned',
  }]).select().single()
  if (!session) throw new Error('Failed to assign training')

  return {
    id: (session as any).id, employeeId, programId,
    status: 'assigned', score: 0,
    startedAt: new Date().toISOString(), completedAt: null,
    certified: false,
  }
}

export async function completeTraining(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  score: number
): Promise<TrainingSession> {
  const { data: session } = await supabase.from('employee_training').select('*, agents!inner(name, department, skills, training_count, performance_score)').eq('id', sessionId).single()
  if (!session) throw new Error('Training session not found')

  const s = session as any
  const program = TRAINING_PROGRAMS.find(p => p.id === s.program_id)
  const certified = score >= 80

  await supabase.from('employee_training').update({
    status: 'completed', score, certified,
    completed_at: new Date().toISOString(),
  }).eq('id', sessionId)

  const currentSkills = s.agents?.skills || []
  if (program && !currentSkills.includes(program.skill)) {
    currentSkills.push(program.skill)
  }

  const trainingCount = (s.agents?.training_count || 0) + 1
  const newScore = Math.min(100, (s.agents?.performance_score || 50) + (certified ? 8 : 3))

  await supabase.from('agents').update({
    skills: currentSkills,
    performance_score: newScore,
    training_count: trainingCount,
    last_trained_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', s.agent_id)

  const employeeName = s.agents?.name || 'Unknown'
  await storeMemory(supabase, userId, {
    category: 'employee_learning', tags: ['training', s.agent_id, program?.skill || ''],
    content: { type: 'training_completed', employeeName, employeeId: s.agent_id, program: program?.name, skill: program?.skill, score, certified, completedAt: new Date().toISOString() },
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: `[Training] ${employeeName} completed ${program?.name || 'training'} (${certified ? 'Certified' : 'Completed'})`,
    module: s.agents?.department || 'general', status: 'success',
    message: `Score: ${score}%, Skill: ${program?.skill || 'N/A'}`,
    entity_type: 'agent', entity_id: s.agent_id,
  }])

  return {
    id: s.id, employeeId: s.agent_id, programId: s.program_id,
    status: 'completed', score, certified,
    startedAt: s.created_at, completedAt: new Date().toISOString(),
  }
}

export async function getTrainingHistory(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string
): Promise<TrainingSession[]> {
  const { data: sessions } = await supabase
    .from('employee_training')
    .select('*')
    .eq('agent_id', employeeId)
    .order('created_at', { ascending: false })

  return ((sessions ?? []) as any[]).map(s => ({
    id: s.id, employeeId: s.agent_id, programId: s.program_id,
    status: s.status, score: s.score || 0,
    startedAt: s.created_at, completedAt: s.completed_at,
    certified: s.certified || false,
  }))
}

export async function getEmployeeCertifications(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string
): Promise<TrainingProgram[]> {
  const history = await getTrainingHistory(supabase, userId, employeeId)
  const certified = history.filter(s => s.certified)
  return TRAINING_PROGRAMS.filter(p => certified.some(s => s.programId === p.id))
}
