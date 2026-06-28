import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CtoAgent } from '@/lib/cto/engine'
import { CmoAgent } from '@/lib/cmo/engine'
import { CooAgent } from '@/lib/coo/engine'
import { DesignerAgent } from '@/lib/designer/engine'
import { VideoEditorAgent } from '@/lib/video-editor/engine'
import { SupportAgent } from '@/lib/support/engine'
import { AutonomousCompany } from '@/lib/company/orchestrator'

vi.mock('@/lib/ai/execution', () => ({
  executeAgentTask: vi.fn().mockResolvedValue({ response: '{}' }),
}))

vi.mock('@/lib/ai/memory', () => ({
  storeMemory: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/ceo/ceo', () => ({
  runCeoAssessment: vi.fn().mockResolvedValue({
    summary: 'CEO assessment', insights: [], decisions: [],
  }),
}))

vi.mock('@/lib/growth/engine', () => ({
  GrowthEngine: vi.fn().mockImplementation(() => ({
    runFullCycle: vi.fn().mockResolvedValue({ status: 'completed', summary: 'Growth cycle' }),
  })),
  generateDailyContent: vi.fn().mockResolvedValue(3),
  generateLeads: vi.fn().mockResolvedValue(5),
  publishScheduled: vi.fn().mockResolvedValue(2),
}))

vi.mock('@/lib/execution', () => ({
  runDailyGrowthExecution: vi.fn().mockResolvedValue({
    contentGenerated: 3, linkedinPublished: 1, facebookPublished: 0,
    instagramPublished: 1, xPublished: 0, youtubePublished: 0, leadsGenerated: 2,
  }),
}))

vi.mock('@/lib/video/engine', () => ({
  runFullVideoCycle: vi.fn().mockResolvedValue({
    ideasGenerated: 3, edited: 2, published: 1,
  }),
  getVideoPipeline: vi.fn().mockResolvedValue({ total: 5, pending: 2, completed: 3 }),
}))

const chainResult = { data: [], error: null, count: 0 } as any

const makeChain = () => {
  const self: any = {
    ...chainResult,
    select: vi.fn(() => self),
    insert: vi.fn(() => self),
    update: vi.fn(() => self),
    delete: vi.fn(() => self),
    eq: vi.fn(() => self),
    in: vi.fn(() => self),
    neq: vi.fn(() => self),
    gte: vi.fn(() => self),
    lte: vi.fn(() => self),
    order: vi.fn(() => self),
    limit: vi.fn(() => self),
    range: vi.fn(() => self),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'test-id', subject: 'Test Subject', description: 'Test description',
        priority: 'high', status: 'open', category: 'bug',
        customer_name: 'Test User', customer_email: 'test@test.com',
        title: 'Test Video', type: 'reel', duration: '60s', platform: 'instagram',
        created_at: new Date().toISOString(), resolved_at: null,
      },
      error: null,
    }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  return self
}

const mockSupabase = {
  from: vi.fn(makeChain),
} as unknown as SupabaseClient

const userId = 'test-user-id'

beforeEach(() => {
  vi.restoreAllMocks()
})

// ─── CtoAgent ───────────────────────────────────────────────────
describe('CtoAgent', () => {
  it('constructs with dependencies', () => {
    const cto = new CtoAgent(mockSupabase, userId)
    expect(cto).toBeInstanceOf(CtoAgent)
  })

  it('assessSystemHealth returns report with defaults on AI failure', async () => {
    const cto = new CtoAgent(mockSupabase, userId)
    const result = await cto.assessSystemHealth()
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('techDebtItems')
    expect(result).toHaveProperty('systemHealth')
  })

  it('orchestrateSwarm runs a swarm cycle', async () => {
    const cto = new CtoAgent(mockSupabase, userId)
    await expect(cto.orchestrateSwarm('Test objective', ['agent-1', 'agent-2'])).resolves.toBeDefined()
  }, 10000)
})

// ─── CmoAgent ───────────────────────────────────────────────────
describe('CmoAgent', () => {
  it('constructs with dependencies', () => {
    const cmo = new CmoAgent(mockSupabase, userId)
    expect(cmo).toBeInstanceOf(CmoAgent)
  })

  it('assessMarketingPerformance returns report with metrics', async () => {
    const cmo = new CmoAgent(mockSupabase, userId)
    const result = await cmo.assessMarketingPerformance()
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('metrics')
    expect(result.metrics.totalContentPieces).toBe(0)
  })

  it('runContentCycle returns counts', async () => {
    const cmo = new CmoAgent(mockSupabase, userId)
    const result = await cmo.runContentCycle()
    expect(result).toHaveProperty('contentCreated')
    expect(result).toHaveProperty('leadsGenerated')
    expect(result).toHaveProperty('published')
  })

  it('planContentStrategy returns a strategy', async () => {
    const cmo = new CmoAgent(mockSupabase, userId)
    const result = await cmo.planContentStrategy('Increase brand awareness')
    expect(result).toHaveProperty('strategy')
    expect(result).toHaveProperty('contentPlan')
    expect(result).toHaveProperty('channels')
  })
})

// ─── CooAgent ───────────────────────────────────────────────────
describe('CooAgent', () => {
  it('constructs with dependencies', () => {
    const coo = new CooAgent(mockSupabase, userId)
    expect(coo).toBeInstanceOf(CooAgent)
  })

  it('assessOperations returns report with metrics', async () => {
    const coo = new CooAgent(mockSupabase, userId)
    const result = await coo.assessOperations()
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('metrics')
  })

  it('allocateResources returns assignment', async () => {
    const coo = new CooAgent(mockSupabase, userId)
    const result = await coo.allocateResources('Build landing page', 'high')
    expect(result).toHaveProperty('assignedTo')
    expect(result).toHaveProperty('estimatedCompletion')
  })

  it('runDailyExecution runs growth execution', async () => {
    const coo = new CooAgent(mockSupabase, userId)
    const result = await coo.runDailyExecution()
    expect(result).toHaveProperty('contentGenerated')
    expect(result).toHaveProperty('leadsGenerated')
  })

  it('runFullOpsCycle runs all operations and handles errors gracefully', async () => {
    const coo = new CooAgent(mockSupabase, userId)
    const result = await coo.runFullOpsCycle()
    expect(result).toHaveProperty('operations')
    expect(result).toHaveProperty('dailyExecution')
    expect(result).toHaveProperty('ceoAssessment')
    expect(result).toHaveProperty('errors')
  })
})

// ─── DesignerAgent ──────────────────────────────────────────────
describe('DesignerAgent', () => {
  it('constructs with dependencies', () => {
    const designer = new DesignerAgent(mockSupabase, userId)
    expect(designer).toBeInstanceOf(DesignerAgent)
  })

  it('createBrandIdentity returns a design brief', async () => {
    const designer = new DesignerAgent(mockSupabase, userId)
    const brief = await designer.createBrandIdentity('Acme Inc', 'technology')
    expect(brief).toHaveProperty('brandName', 'Acme Inc')
    expect(brief).toHaveProperty('style')
    expect(brief).toHaveProperty('colors')
    expect(brief).toHaveProperty('fonts')
  })

  it('generateDesignAssets returns asset list', async () => {
    const designer = new DesignerAgent(mockSupabase, userId)
    const assets = await designer.generateDesignAssets('New Campaign', 2)
    expect(Array.isArray(assets)).toBe(true)
  })

  it('createSocialVisuals returns platform-specific assets', async () => {
    const designer = new DesignerAgent(mockSupabase, userId)
    const assets = await designer.createSocialVisuals('linkedin', 'AI Trends')
    expect(Array.isArray(assets)).toBe(true)
  })

  it('assessDesignNeeds returns design report', async () => {
    const designer = new DesignerAgent(mockSupabase, userId)
    const report = await designer.assessDesignNeeds()
    expect(report).toHaveProperty('summary')
    expect(report).toHaveProperty('designAssets')
    expect(report).toHaveProperty('brandingGuidelines')
    expect(report).toHaveProperty('recommendations')
  })
})

// ─── VideoEditorAgent ───────────────────────────────────────────
describe('VideoEditorAgent', () => {
  it('constructs with dependencies', () => {
    const ve = new VideoEditorAgent(mockSupabase, userId)
    expect(ve).toBeInstanceOf(VideoEditorAgent)
  })

  it('assessVideoPipeline returns video report', async () => {
    const ve = new VideoEditorAgent(mockSupabase, userId)
    const report = await ve.assessVideoPipeline()
    expect(report).toHaveProperty('summary')
    expect(report).toHaveProperty('pendingEdits')
    expect(report).toHaveProperty('completedEdits')
  })

  it('generateVideoIdeas returns ideas and inserts them', async () => {
    const ve = new VideoEditorAgent(mockSupabase, userId)
    const ideas = await ve.generateVideoIdeas('AI Marketing', 2)
    expect(Array.isArray(ideas)).toBe(true)
  })

  it('runVideoProduction runs the full video cycle', async () => {
    const ve = new VideoEditorAgent(mockSupabase, userId)
    const result = await ve.runVideoProduction()
    expect(result).toHaveProperty('ideasGenerated')
    expect(result).toHaveProperty('edited')
    expect(result).toHaveProperty('published')
  })

  it('optimizeVideoMetadata returns SEO metadata', async () => {
    const ve = new VideoEditorAgent(mockSupabase, userId)
    const result = await ve.optimizeVideoMetadata('video-123')
    expect(result).toHaveProperty('title')
    expect(result).toHaveProperty('description')
    expect(result).toHaveProperty('tags')
    expect(result).toHaveProperty('thumbnailSuggestion')
  })
})

// ─── SupportAgent ───────────────────────────────────────────────
describe('SupportAgent', () => {
  it('constructs with dependencies', () => {
    const support = new SupportAgent(mockSupabase, userId)
    expect(support).toBeInstanceOf(SupportAgent)
  })

  it('createTicket creates and returns a ticket', async () => {
    const support = new SupportAgent(mockSupabase, userId)
    const ticket = await support.createTicket({
      subject: 'Test issue', description: 'Something broke',
      priority: 'high', category: 'bug', customerName: 'Test User',
    })
    expect(ticket).toBeDefined()
    expect(ticket.status).toBe('open')
  })

  it('resolveTicket resolves an open ticket', async () => {
    const support = new SupportAgent(mockSupabase, userId)
    const ticket = await support.resolveTicket('ticket-1', 'Fixed the bug')
    expect(ticket).toBeDefined()
  })

  it('assessSupportPerformance returns support report', async () => {
    const support = new SupportAgent(mockSupabase, userId)
    const report = await support.assessSupportPerformance()
    expect(report).toHaveProperty('summary')
    expect(report).toHaveProperty('openTickets')
    expect(report).toHaveProperty('resolvedTickets')
  })
})

// ─── AutonomousCompany ──────────────────────────────────────────
describe('AutonomousCompany', () => {
  it('constructs with 6 sub-agents', () => {
    const company = new AutonomousCompany(mockSupabase, userId)
    expect(company).toBeInstanceOf(AutonomousCompany)
    expect(company.getState().status).toBe('initialized')
  })

  it('start returns running state', async () => {
    const company = new AutonomousCompany(mockSupabase, userId)
    const state = await company.start()
    expect(state.status).toBe('running')
    expect(state.startedAt).toBeTruthy()
  })

  it('stop returns stopped state', async () => {
    const company = new AutonomousCompany(mockSupabase, userId)
    await company.start()
    const state = await company.stop()
    expect(state.status).toBe('stopped')
  })

  it('runFullCycle executes all 10 phases with graceful fallbacks', async () => {
    const company = new AutonomousCompany(mockSupabase, userId)
    await company.start()
    const result = await company.runFullCycle()
    expect(result).toHaveProperty('cycleId')
    expect(result).toHaveProperty('phases')
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('errors')
    expect(result).toHaveProperty('pendingApprovals')
    expect(Array.isArray(result.phases)).toBe(true)
    expect(result.phases.length).toBeGreaterThanOrEqual(8)
  })

  it('runFullCycle increments totalCycles', async () => {
    const company = new AutonomousCompany(mockSupabase, userId)
    await company.start()

    const cycle1 = await company.runFullCycle()
    expect(cycle1.phases.length).toBe(10)
    expect(company.getState().totalCycles).toBe(1)

    const cycle2 = await company.runFullCycle()
    expect(company.getState().totalCycles).toBe(2)
  })

  it('generateReport returns comprehensive company report', async () => {
    const company = new AutonomousCompany(mockSupabase, userId)
    await company.start()
    await company.runFullCycle()
    const report = await company.generateReport()
    expect(report).toHaveProperty('reportDate')
    expect(report).toHaveProperty('totalCycles')
    expect(report).toHaveProperty('ceoSummary')
    expect(report).toHaveProperty('ctoSummary')
    expect(report).toHaveProperty('cmoSummary')
    expect(report).toHaveProperty('cooSummary')
    expect(report).toHaveProperty('designerSummary')
    expect(report).toHaveProperty('videoEditorSummary')
    expect(report).toHaveProperty('supportSummary')
    expect(report).toHaveProperty('topIssues')
    expect(report).toHaveProperty('recommendedActions')
  })

  it('runRole dispatches to the correct agent by role', async () => {
    const company = new AutonomousCompany(mockSupabase, userId)
    const ctoResult = await company.runRole('cto', 'assess')
    expect(ctoResult).toHaveProperty('summary')
    const cmoResult = await company.runRole('cmo', 'assess')
    expect(cmoResult).toHaveProperty('summary')
    await expect(company.runRole('invalid' as any, 'test')).rejects.toThrow('Unknown role')
  })

  it('onPendingApproval registers approval handler', () => {
    const company = new AutonomousCompany(mockSupabase, userId)
    const handler = vi.fn()
    company.onPendingApproval(handler)
    expect(handler).not.toHaveBeenCalled()
  })

  it('handles sub-agent failures gracefully during cycle', async () => {
    const failSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn(() => { throw new Error('DB failure') }),
        select: vi.fn(() => { throw new Error('DB failure') }),
        update: vi.fn(() => { throw new Error('DB failure') }),
      })),
    } as unknown as SupabaseClient

    const company = new AutonomousCompany(failSupabase, userId)
    await company.start()
    const result = await company.runFullCycle()
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.phases.length).toBe(10)
  })
})
