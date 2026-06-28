import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import { enqueueJob, fetchJobs } from '@/lib/queue/queue'
import { hireEmployee, completeOnboarding } from '@/lib/employees/hiring'
import { setCompensation, getDepartmentCompensationReport } from '@/lib/employees/compensation'
import { initializeKPIs, getDepartmentKPIReport, updateKPIMetric } from '@/lib/employees/kpi'
import { analyzeSkillGaps, assignTraining, completeTraining, getEmployeeCertifications } from '@/lib/employees/training'
import { initiateReview, completeReview } from '@/lib/employees/reviews'
import { checkPromotionEligibility, proposePromotion, approvePromotion } from '@/lib/employees/promotions'
import { initiateOffboarding, findSuccessors } from '@/lib/employees/retirement'
import { evaluateAllEmployees, getEmployeeStats } from '@/lib/employees/employee'
import { DEPARTMENT_SPECIALIZATIONS, type HiringNeed, type FactoryReport } from '@/lib/employees/types'

export interface EnhancedFactoryReport extends FactoryReport {
  hired: number
  trained: number
  promoted: number
  retired: number
  needs: HiringNeed[]
  onboardingCompleted: number
  kpisInitialized: number
  certificationsEarned: number
  reviewsCompleted: number
  successorsFound: number
  totalCompensation: number
  departmentBreakdown: Record<string, { headcount: number; avgScore: number; avgKPI: number; totalComp: number }>
}

export async function analyzeWorkforceNeeds(supabase: SupabaseClient, userId: string): Promise<HiringNeed[]> {
  const { data: agents } = await supabase.from('agents').select('*').eq('user_id', userId)
  const allAgents = (agents ?? []) as any[]

  const jobs = await fetchJobs(supabase, userId)
  const pendingJobs = jobs.filter((j) => j.status === 'pending')

  const { data: tasks } = await supabase.from('orchestrator_tasks').select('*').eq('user_id', userId).eq('status', 'pending')
  const pendingTasks = (tasks ?? []) as any[]

  const needs: HiringNeed[] = []
  const deptAgents: Record<string, any[]> = {}

  for (const a of allAgents) {
    const dept = a.department || 'general'
    if (!deptAgents[dept]) deptAgents[dept] = []
    deptAgents[dept].push(a)
  }

  for (const [dept, members] of Object.entries(deptAgents)) {
    const active = members.filter((m: any) => m.status === 'active' || m.status === 'idle' || m.status === 'onboarding')
    const avgPerf = members.length > 0 ? Math.round(members.reduce((s: number, m: any) => s + (m.performance_score || 0), 0) / members.length) : 0
    const recentHires = members.filter((m: any) => {
      const hired = m.hired_at ? new Date(m.hired_at).getTime() : 0
      return Date.now() - hired < 7 * 24 * 60 * 60 * 1000
    })

    if (active.length === 0 && members.length > 0) {
      needs.push({ department: dept, reason: `All ${dept} employees offline`, priority: 9, suggestedSpecialization: '' })
    }
    if (avgPerf < 40 && members.length >= 2 && recentHires.length === 0) {
      needs.push({ department: dept, reason: `Low avg performance (${avgPerf}%)`, priority: 7, suggestedSpecialization: '' })
    }
    if (members.length === 0) {
      needs.push({ department: dept, reason: `${dept} has no employees`, priority: 10, suggestedSpecialization: DEPARTMENT_SPECIALIZATIONS[dept]?.[0] || 'general' })
    }
  }

  if (pendingJobs.length > 20) {
    needs.push({ department: 'operations', reason: `${pendingJobs.length} pending jobs`, priority: 7, suggestedSpecialization: 'workflow_automation' })
  }
  if (pendingTasks.length > 15) {
    needs.push({ department: 'operations', reason: `${pendingTasks.length} pending tasks`, priority: 6, suggestedSpecialization: 'project_management' })
  }

  if (needs.length === 0) {
    const smallest = Object.entries(deptAgents).sort(([, a], [, b]) => a.length - b.length)[0]
    if (smallest) {
      needs.push({
        department: smallest[0],
        reason: `${smallest[0]} has only ${smallest[1].length} employee(s)`,
        priority: 4,
        suggestedSpecialization: DEPARTMENT_SPECIALIZATIONS[smallest[0]]?.[0] || 'general',
      })
    }
  }

  return needs.sort((a, b) => b.priority - a.priority)
}

export async function runFullFactoryCycle(supabase: SupabaseClient, userId: string): Promise<EnhancedFactoryReport> {
  let hired = 0; let trained = 0; let promoted = 0; let retired = 0
  let onboardingCompleted = 0; let kpisInitialized = 0
  let certificationsEarned = 0; let reviewsCompleted = 0
  let successorsFound = 0

  // 1. Analyze workforce needs
  const needs = await analyzeWorkforceNeeds(supabase, userId)

  // 2. Hire for top needs
  const topNeeds = needs.slice(0, 3)
  for (const need of topNeeds) {
    try {
      const spec = need.suggestedSpecialization || DEPARTMENT_SPECIALIZATIONS[need.department]?.[0] || 'general'
      const agentId = await hireEmployee(supabase, userId, need.department, spec)
      if (agentId) {
        hired++
        await setCompensation(supabase, userId, agentId, need.department, 1)
        await initializeKPIs(supabase, userId, agentId, need.department)
        kpisInitialized++
      }
    } catch { /* continue */ }
  }

  // 3. Complete onboarding for hires in onboarding status
  const { data: onboardingAgents } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'onboarding')
    .limit(5)

  for (const agent of (onboardingAgents ?? []) as any[]) {
    try {
      await completeOnboarding(supabase, userId, agent.id)
      onboardingCompleted++
    } catch { /* continue */ }
  }

  // 4. Train low-performers via skill gap analysis
  const { data: lowPerformers } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', userId)
    .lt('performance_score', 60)
    .not('status', 'eq', 'offline')
    .limit(5)

  for (const agent of (lowPerformers ?? []) as any[]) {
    try {
      const gaps = await analyzeSkillGaps(supabase, userId, agent.id)
      if (gaps.recommendedPrograms.length > 0) {
        const program = gaps.recommendedPrograms[0]
        const session = await assignTraining(supabase, userId, agent.id, program.id)
        const result = await completeTraining(supabase, userId, session.id, 85)
        if (result.certified) certificationsEarned++
        trained++
      }
    } catch { /* continue */ }
  }

  // 5. Check promotions
  const { data: promotable } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', userId)
    .gte('performance_score', 30)
    .lt('level', 5)
    .not('status', 'eq', 'offline')
    .limit(5)

  for (const agent of (promotable ?? []) as any[]) {
    try {
      const eligibility = await checkPromotionEligibility(supabase, userId, agent.id)
      if (eligibility.eligible) {
        const prom = await proposePromotion(supabase, userId, agent.id)
        await approvePromotion(supabase, userId, prom.id, 'factory_cycle')
        promoted++
      }
    } catch { /* continue */ }
  }

  // 6. Run performance reviews for active employees
  const { data: reviewCandidates } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', userId)
    .not('status', 'eq', 'offline')
    .limit(5)

  for (const agent of (reviewCandidates ?? []) as any[]) {
    try {
      const review = await initiateReview(supabase, userId, agent.id, 'monthly')
      await completeReview(supabase, userId, review.id, agent.id)
      reviewsCompleted++
    } catch { /* continue */ }
  }

  // 7. Handle retirements and succession
  const { data: retireCandidates } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .not('status', 'eq', 'offline')

  for (const agent of (retireCandidates ?? []) as any[]) {
    const lastActive = agent.last_active_at ? new Date(agent.last_active_at).getTime() : 0
    const daysInactive = lastActive > 0 ? (Date.now() - lastActive) / (1000 * 60 * 60 * 24) : 999

    if (daysInactive > 30 || agent.performance_score < 10) {
      try {
        const successors = await findSuccessors(supabase, userId, agent.id)
        successorsFound += successors.length
        await initiateOffboarding(supabase, userId, agent.id, daysInactive > 30 ? 'Inactivity' : 'Low performance')
        retired++
      } catch { /* continue */ }
    }
  }

  // 8. Run evaluateAllEmployees for level recalculation
  await evaluateAllEmployees(supabase, userId)

  // 9. Gather department breakdown
  const deptBreakdown: Record<string, { headcount: number; avgScore: number; avgKPI: number; totalComp: number }> = {}
  const departments = Object.keys(DEPARTMENT_SPECIALIZATIONS)

  for (const dept of departments) {
    try {
      const stats = await getEmployeeStats(supabase, userId)
      const compReport = await getDepartmentCompensationReport(supabase, userId, dept)
      const kpiReport = await getDepartmentKPIReport(supabase, userId, dept).catch(() => ({ avgScore: 0 } as any))
      deptBreakdown[dept] = {
        headcount: compReport.headcount,
        avgScore: 0,
        avgKPI: kpiReport.avgScore || 0,
        totalComp: compReport.totalSalary,
      }
    } catch { /* skip */ }
  }

  const totalComp = Object.values(deptBreakdown).reduce((s, d) => s + d.totalComp, 0)

  // 10. Generate AI summary
  const systemPrompt = `Summarize this enhanced factory cycle briefly in 2-3 sentences.`
  const summaryResult = await executeAgentTask(supabase, userId, null,
    `Factory cycle results: Hired ${hired}, Onboarded ${onboardingCompleted}, Trained ${trained} (${certificationsEarned} certified), Promoted ${promoted}, Reviews ${reviewsCompleted}, Retired ${retired}, Successors ${successorsFound}. Needs: ${needs.length}. Total compensation: $${totalComp.toLocaleString()}.`,
    { systemPrompt }
  )

  // Store in Company Brain
  await storeMemory(supabase, userId, {
    category: 'growth_pattern',
    content: {
      type: 'enhanced_factory_cycle', hired, onboardingCompleted, trained, certificationsEarned,
      promoted, reviewsCompleted, retired, successorsFound, needs: needs.slice(0, 5),
      totalCompensation: totalComp, departmentBreakdown: deptBreakdown,
      summary: summaryResult.response, runAt: new Date().toISOString(),
    },
    tags: ['factory', 'enhanced', 'employee_lifecycle'],
  })

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: '[Factory] Enhanced cycle completed',
    module: 'agents', status: 'success',
    message: `Hired: ${hired}, Trained: ${trained}, Promoted: ${promoted}, Reviews: ${reviewsCompleted}, Retired: ${retired}`,
  }])

  return {
    hired, trained, promoted, retired, needs,
    summary: summaryResult.response || '',
    onboardingCompleted, kpisInitialized, certificationsEarned,
    reviewsCompleted, successorsFound, totalCompensation: totalComp,
    departmentBreakdown: deptBreakdown,
  }
}

export async function getFactoryStats(supabase: SupabaseClient, userId: string): Promise<{
  totalEmployees: number; avgLevel: number; avgPerformance: number; totalTraining: number
  activeHires: number; retiredCount: number; totalPromotions: number; totalCertified: number; totalReviews: number
}> {
  const { data: agents } = await supabase.from('agents').select('*').eq('user_id', userId)
  const allAgents = (agents ?? []) as any[]

  const { data: certs } = await supabase.from('employee_training').select('id').eq('user_id', userId).eq('certified', true)
  const { data: reviews } = await supabase.from('employee_reviews').select('id').eq('user_id', userId).eq('status', 'completed')

  return {
    totalEmployees: allAgents.length,
    avgLevel: allAgents.length ? Math.round(allAgents.reduce((s, a) => s + (a.level || 1), 0) / allAgents.length) : 0,
    avgPerformance: allAgents.length ? Math.round(allAgents.reduce((s, a) => s + (a.performance_score || 0), 0) / allAgents.length) : 0,
    totalTraining: allAgents.reduce((s, a) => s + (a.training_count || 0), 0),
    activeHires: allAgents.filter((a) => !a.retired_at && a.status !== 'offline').length,
    retiredCount: allAgents.filter((a) => a.retired_at).length,
    totalPromotions: allAgents.filter((a) => a.promoted_at).length,
    totalCertified: (certs ?? []).length,
    totalReviews: (reviews ?? []).length,
  }
}
