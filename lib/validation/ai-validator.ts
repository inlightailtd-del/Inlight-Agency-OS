import { BaseValidator, type ValidationResult } from './types'

const AI_PROVIDERS = ['openai_realtime', 'elevenlabs', 'claude']

export class AIProvidersValidator extends BaseValidator {
  get slug() { return 'ai-providers' }
  get name() { return 'AI Providers' }
  get category() { return 'ai' }

  async validate(): Promise<ValidationResult> {
    const start = Date.now()
    const providerStatuses: Record<string, any> = {}

    for (const provider of AI_PROVIDERS) {
      const { data: creds } = await this.supabase
        .from('integration_credentials')
        .select('id, auth_type', { count: 'exact', head: false })
        .eq('user_id', this.userId)
        .eq('provider', provider)
        .eq('is_expired', false)
        .limit(1)

      const { data: conns } = await this.supabase
        .from('integration_connections')
        .select('id, status', { count: 'exact', head: false })
        .eq('user_id', this.userId)
        .eq('provider', provider)
        .eq('is_active', true)
        .limit(1)

      providerStatuses[provider] = {
        hasCredentials: !!creds?.[0],
        hasConnection: !!conns?.[0],
        connectionStatus: conns?.[0]?.status || null,
      }
    }

    // Check if AI agents exist and have execution history
    const { data: agents } = await this.supabase
      .from('agents')
      .select('id, name, type, status, total_executions, success_rate')
      .eq('user_id', this.userId)
      .limit(20)

    const { data: agentLogs } = await this.supabase
      .from('agent_logs')
      .select('id, agent_name, status, duration_ms, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    const connectedProviders = Object.entries(providerStatuses)
      .filter(([_, s]) => (s as any).hasCredentials)
      .map(([p, _]) => p)

    const activeAgents = (agents || []).filter(a => a.status === 'active')

    return {
      slug: this.slug, name: this.name, category: this.category,
      status: (activeAgents.length > 0 || connectedProviders.length > 0) ? 'working' : 'skipped',
      message: `${activeAgents.length} active AI agents${connectedProviders.length > 0 ? ', ' + connectedProviders.length + ' AI providers' : ''}`,
      details: {
        activeAgents: activeAgents.map(a => ({
          name: a.name,
          type: a.type,
          executions: a.total_executions,
          successRate: a.success_rate,
        })),
        providerConnections: providerStatuses,
        recentExecutions: (agentLogs || []).slice(0, 5).map(l => ({
          agentName: l.agent_name,
          status: l.status,
          durationMs: l.duration_ms,
          createdAt: l.created_at,
        })),
      },
      durationMs: Date.now() - start,
    }
  }
}

export class ProductionBuildValidator extends BaseValidator {
  get slug() { return 'production-build' }
  get name() { return 'Production Build' }
  get category() { return 'system' }

  async validate(): Promise<ValidationResult> {
    const start = Date.now()
    // We can't run next build from here, but we can verify the build output exists
    const fs = await import('fs')
    const path = await import('path')

    const buildExists = fs.existsSync(path.join(process.cwd(), '.next', 'BUILD_ID'))
    const buildId = buildExists
      ? fs.readFileSync(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf-8').trim()
      : null

    return {
      slug: this.slug, name: this.name, category: this.category,
      status: buildExists ? 'working' : 'warning',
      message: buildExists
        ? `Production build exists — BUILD_ID: ${buildId}`
        : 'No .next/BUILD_ID found (run npm run build)',
      details: {
        buildExists,
        buildId,
        cwd: process.cwd(),
      },
      durationMs: Date.now() - start,
    }
  }
}

export class DatabaseConnectionValidator extends BaseValidator {
  get slug() { return 'database-connection' }
  get name() { return 'Database Connection' }
  get category() { return 'system' }

  async validate(): Promise<ValidationResult> {
    const start = Date.now()

    try {
      // Test basic connectivity by querying a simple table
      const { data, error, count } = await this.supabase
        .from('integration_registry')
        .select('id, provider', { count: 'exact', head: false })
        .limit(5)

      if (error) {
        return {
          slug: this.slug, name: this.name, category: this.category,
          status: 'broken', message: `Database query failed: ${error.message}`,
          details: { error: error.message, code: error.code }, durationMs: Date.now() - start,
        }
      }

      // Check all critical tables exist
      const tablesToCheck = [
        'profiles', 'integration_credentials', 'integration_connections',
        'content_requests', 'execution_logs', 'growth_content_calendar',
        'leads', 'agents', 'agent_logs', 'validation_registry',
      ]

      const tableStatus: Record<string, boolean> = {}
      for (const table of tablesToCheck) {
        try {
          const { count: c } = await this.supabase
            .from(table)
            .select('id', { count: 'exact', head: true })
            .limit(1) as any
          tableStatus[table] = true
        } catch {
          tableStatus[table] = false
        }
      }

      const missingTables = Object.entries(tableStatus).filter(([_, exists]) => !exists).map(([t]) => t)

      return {
        slug: this.slug, name: this.name, category: this.category,
        status: missingTables.length > 0 ? 'warning' : 'working',
        message: `Supabase connected — ${(data || []).length} providers in registry${missingTables.length > 0 ? ', missing: ' + missingTables.join(', ') : ''}`,
        details: {
          providersFound: (data || []).map((r: any) => r.provider),
          tablesAccessible: Object.entries(tableStatus).filter(([_, v]) => v).map(([t]) => t),
          tablesMissing: missingTables,
          allTablesOk: missingTables.length === 0,
        },
        durationMs: Date.now() - start,
      }
    } catch (e: any) {
      return {
        slug: this.slug, name: this.name, category: this.category,
        status: 'broken', message: `Database connection failed: ${e.message}`,
        details: { error: e.message }, durationMs: Date.now() - start,
      }
    }
  }
}
