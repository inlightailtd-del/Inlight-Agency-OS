import type { SupabaseClient } from '@supabase/supabase-js'

export interface Employee {
  id: string
  name: string
  role: string | null
  type: string
  department: string | null
  status: string
  performance_score: number
  success_rate: number
  tasks_completed: number
  total_executions: number
  level: number
  skills: string[]
  specialization: string | null
  training_count: number
  last_trained_at: string | null
  hired_at: string | null
  promoted_at: string | null
  retired_at: string | null
  last_active_at: string | null
  created_at: string
  config: Record<string, any> | null
}

export interface CompensationBand {
  department: string
  level: number
  minSalary: number
  maxSalary: number
  currency: string
  equityPercent?: number
  bonusTargetPercent?: number
  commissionRate?: number
}

export interface EmployeeCompensation {
  employeeId: string
  salary: number
  currency: string
  bonusTarget: number
  bonusEarned: number
  commissionRate: number
  commissionEarned: number
  equityPercent: number
  totalCompYTD: number
  lastReviewRaise: number
  lastReviewRaiseAt: string | null
  effectiveAt: string
}

export interface KPI {
  id: string
  employeeId: string
  metric: string
  target: number
  actual: number
  weight: number
  period: 'weekly' | 'monthly' | 'quarterly'
  periodStart: string
  periodEnd: string
  score: number
}

export interface HiringNeed {
  department: string
  reason: string
  priority: number
  suggestedSpecialization: string
}

export interface FactoryReport {
  summary: string
  onboardingCompleted: number
  kpisInitialized: number
  certificationsEarned: number
  reviewsCompleted: number
  successorsFound: number
  totalCompensation: number
  departmentBreakdown: Record<string, { headcount: number; avgScore: number; avgKPI: number; totalComp: number }>
}

export interface PerformanceReview {
  id: string
  employeeId: string
  reviewerId?: string
  cycle: string
  period: string
  overallScore: number
  scores: Record<string, number>
  strengths: string[]
  improvements: string[]
  goals: string[]
  status: 'draft' | 'submitted' | 'acknowledged' | 'completed'
  submittedAt: string | null
  completedAt: string | null
}

export interface Promotion {
  id: string
  employeeId: string
  fromLevel: number
  toLevel: number
  fromTitle: string
  toTitle: string
  salaryAdjustment: number
  reason: string
  approvedBy?: string
  status: 'proposed' | 'approved' | 'completed' | 'declined'
  proposedAt: string
  completedAt: string | null
}

export interface OnboardingStep {
  step: string
  description: string
  completed: boolean
  completedAt: string | null
}

export interface OffboardingPlan {
  employeeId: string
  reason: string
  knowledgeTransferItems: { asset: string; transferredTo: string; completed: boolean }[]
  status: 'planned' | 'in_progress' | 'completed'
  plannedAt: string
  completedAt: string | null
}

export const PROMOTION_THRESHOLDS = [
  { level: 1, minScore: 0, minSuccessRate: 0, title: 'Junior' },
  { level: 2, minScore: 30, minSuccessRate: 60, title: 'Mid' },
  { level: 3, minScore: 55, minSuccessRate: 75, title: 'Senior' },
  { level: 4, minScore: 75, minSuccessRate: 85, title: 'Lead' },
  { level: 5, minScore: 90, minSuccessRate: 92, title: 'Principal' },
]

export const COMPENSATION_BANDS: CompensationBand[] = [
  { department: 'sales', level: 1, minSalary: 40000, maxSalary: 60000, currency: 'USD', bonusTargetPercent: 10, commissionRate: 0.05 },
  { department: 'sales', level: 2, minSalary: 55000, maxSalary: 80000, currency: 'USD', bonusTargetPercent: 15, commissionRate: 0.08 },
  { department: 'sales', level: 3, minSalary: 75000, maxSalary: 110000, currency: 'USD', bonusTargetPercent: 20, commissionRate: 0.10 },
  { department: 'sales', level: 4, minSalary: 100000, maxSalary: 150000, currency: 'USD', bonusTargetPercent: 25, commissionRate: 0.12 },
  { department: 'sales', level: 5, minSalary: 140000, maxSalary: 200000, currency: 'USD', bonusTargetPercent: 30, commissionRate: 0.15 },
  { department: 'marketing', level: 1, minSalary: 35000, maxSalary: 55000, currency: 'USD', bonusTargetPercent: 8 },
  { department: 'marketing', level: 2, minSalary: 50000, maxSalary: 75000, currency: 'USD', bonusTargetPercent: 10 },
  { department: 'marketing', level: 3, minSalary: 70000, maxSalary: 100000, currency: 'USD', bonusTargetPercent: 15 },
  { department: 'marketing', level: 4, minSalary: 95000, maxSalary: 140000, currency: 'USD', bonusTargetPercent: 20 },
  { department: 'marketing', level: 5, minSalary: 130000, maxSalary: 190000, currency: 'USD', bonusTargetPercent: 25 },
  { department: 'content', level: 1, minSalary: 30000, maxSalary: 50000, currency: 'USD', bonusTargetPercent: 5 },
  { department: 'content', level: 2, minSalary: 45000, maxSalary: 70000, currency: 'USD', bonusTargetPercent: 8 },
  { department: 'content', level: 3, minSalary: 65000, maxSalary: 95000, currency: 'USD', bonusTargetPercent: 10 },
  { department: 'content', level: 4, minSalary: 90000, maxSalary: 130000, currency: 'USD', bonusTargetPercent: 15 },
  { department: 'content', level: 5, minSalary: 120000, maxSalary: 170000, currency: 'USD', bonusTargetPercent: 20 },
  { department: 'operations', level: 1, minSalary: 35000, maxSalary: 55000, currency: 'USD', bonusTargetPercent: 5 },
  { department: 'operations', level: 2, minSalary: 50000, maxSalary: 75000, currency: 'USD', bonusTargetPercent: 8 },
  { department: 'operations', level: 3, minSalary: 70000, maxSalary: 100000, currency: 'USD', bonusTargetPercent: 10 },
  { department: 'operations', level: 4, minSalary: 95000, maxSalary: 140000, currency: 'USD', bonusTargetPercent: 15 },
  { department: 'operations', level: 5, minSalary: 130000, maxSalary: 180000, currency: 'USD', bonusTargetPercent: 20 },
  { department: 'finance', level: 1, minSalary: 40000, maxSalary: 60000, currency: 'USD', bonusTargetPercent: 10 },
  { department: 'finance', level: 2, minSalary: 55000, maxSalary: 80000, currency: 'USD', bonusTargetPercent: 12 },
  { department: 'finance', level: 3, minSalary: 75000, maxSalary: 110000, currency: 'USD', bonusTargetPercent: 15 },
  { department: 'finance', level: 4, minSalary: 100000, maxSalary: 150000, currency: 'USD', bonusTargetPercent: 20 },
  { department: 'finance', level: 5, minSalary: 140000, maxSalary: 200000, currency: 'USD', bonusTargetPercent: 25 },
  { department: 'development', level: 1, minSalary: 50000, maxSalary: 75000, currency: 'USD', bonusTargetPercent: 5 },
  { department: 'development', level: 2, minSalary: 70000, maxSalary: 100000, currency: 'USD', bonusTargetPercent: 8 },
  { department: 'development', level: 3, minSalary: 95000, maxSalary: 140000, currency: 'USD', bonusTargetPercent: 10 },
  { department: 'development', level: 4, minSalary: 130000, maxSalary: 180000, currency: 'USD', bonusTargetPercent: 15 },
  { department: 'development', level: 5, minSalary: 170000, maxSalary: 250000, currency: 'USD', bonusTargetPercent: 20, equityPercent: 0.5 },
]

export const DEPARTMENT_SPECIALIZATIONS: Record<string, string[]> = {
  sales: ['lead_generation', 'outreach', 'proposal_writing', 'client_communication', 'cold_calling', 'demo_scheduling'],
  marketing: ['content_marketing', 'social_media', 'seo', 'campaign_management', 'email_marketing', 'brand_strategy'],
  content: ['blog_writing', 'copywriting', 'editing', 'content_strategy', 'video_scripting', 'storytelling'],
  operations: ['workflow_automation', 'project_management', 'quality_assurance', 'process_optimization', 'resource_planning'],
  finance: ['invoicing', 'expense_tracking', 'financial_reporting', 'budgeting', 'forecasting'],
  development: ['frontend', 'backend', 'fullstack', 'devops', 'mobile', 'ai_ml'],
  design: ['ui_design', 'ux_design', 'graphic_design', 'motion_design', 'brand_design'],
  hr: ['recruiting', 'onboarding', 'training', 'payroll', 'culture'],
}

export const SKILL_TREE: Record<string, { name: string; level: number; prerequisites: string[] }[]> = {
  sales: [
    { name: 'lead_generation', level: 1, prerequisites: [] },
    { name: 'cold_calling', level: 2, prerequisites: ['lead_generation'] },
    { name: 'outreach', level: 2, prerequisites: ['lead_generation'] },
    { name: 'proposal_writing', level: 3, prerequisites: ['outreach'] },
    { name: 'client_communication', level: 3, prerequisites: ['outreach', 'cold_calling'] },
    { name: 'demo_scheduling', level: 4, prerequisites: ['client_communication'] },
    { name: 'negotiation', level: 5, prerequisites: ['proposal_writing', 'demo_scheduling'] },
  ],
  marketing: [
    { name: 'content_marketing', level: 1, prerequisites: [] },
    { name: 'social_media', level: 1, prerequisites: [] },
    { name: 'email_marketing', level: 2, prerequisites: ['content_marketing'] },
    { name: 'brand_strategy', level: 3, prerequisites: ['social_media', 'email_marketing'] },
    { name: 'campaign_management', level: 3, prerequisites: ['email_marketing'] },
    { name: 'seo', level: 4, prerequisites: ['content_marketing', 'campaign_management'] },
  ],
  development: [
    { name: 'frontend', level: 1, prerequisites: [] },
    { name: 'backend', level: 1, prerequisites: [] },
    { name: 'fullstack', level: 3, prerequisites: ['frontend', 'backend'] },
    { name: 'devops', level: 3, prerequisites: ['backend'] },
    { name: 'mobile', level: 3, prerequisites: ['frontend'] },
    { name: 'ai_ml', level: 4, prerequisites: ['backend', 'fullstack'] },
  ],
}

export function getEmployeeLevel(score: number, successRate: number): { level: number; title: string } {
  let level = 1
  for (const t of PROMOTION_THRESHOLDS) {
    if (score >= t.minScore && successRate >= t.minSuccessRate) level = t.level
  }
  return { level, title: PROMOTION_THRESHOLDS[level - 1]?.title || 'Junior' }
}
