import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DaemonState, DaemonConfig, HealthMetric, Heartbeat,
  Alert, MonitoringReport, DaemonStatus,
} from './types'

export class NightShiftMonitor {
  private lastHeartbeat: string | null = null
  private errorHistory: string[] = []
  private metricHistory: Map<string, number[]> = new Map()
  private startTime: number = Date.now()

  private consecutiveErrors = 0

  constructor(
    private supabase: SupabaseClient,
    private userId: string,
    private daemonId: string
  ) {}

  async recordHeartbeat(state: DaemonState): Promise<Heartbeat> {
    const metrics = this.collectMetrics(state)
    const heartbeat: Heartbeat = {
      daemonId: this.daemonId,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      loopCount: state.totalLoops,
      status: state.status,
      metrics,
      errors: this.errorHistory.slice(-5),
    }

    try {
      await this.supabase.from('execution_logs').insert([{
        user_id: this.userId,
        command_id: null,
        action: '[NightShift] Heartbeat',
        module: 'night_shift',
        entity_type: 'daemon',
        status: state.status === 'error' ? 'failed' : 'success',
        message: `Loop ${state.totalLoops} | Uptime ${Math.round(heartbeat.uptime / 1000)}s | Score ${this.getHealthScore()}`,
        result: { daemonId: this.daemonId, loopCount: state.totalLoops, uptime: heartbeat.uptime, metrics },
      }])
    } catch { /* best effort */ }

    this.lastHeartbeat = heartbeat.timestamp
    return heartbeat
  }

  async recordAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'acknowledged'>): Promise<Alert> {
    const full: Alert = {
      id: crypto.randomUUID?.() ?? `${Date.now()}`,
      ...alert,
      acknowledged: false,
      createdAt: new Date().toISOString(),
    }

    try {
      await this.supabase.from('agent_memory').insert([{
        user_id: this.userId,
        agent_id: null,
        category: 'night_shift_alert',
        content: full,
        tags: ['night_shift', 'alert', alert.severity, alert.source],
      }])
    } catch { /* best effort */ }

    return full
  }

  async recordError(source: string, message: string): Promise<void> {
    this.consecutiveErrors++
    this.errorHistory.push(`[${new Date().toISOString()}] ${source}: ${message}`)
    if (this.errorHistory.length > 100) this.errorHistory.shift()

    if (this.consecutiveErrors >= 3) {
      await this.recordAlert({
        severity: this.consecutiveErrors >= 5 ? 'critical' : 'warning',
        source,
        title: `Night Shift: Repeated errors (${this.consecutiveErrors}x)`,
        message,
        metadata: { consecutiveErrors: this.consecutiveErrors },
      })
    }
  }

  async generateReport(state: DaemonState, goalsCompleted: number, goalsFailed: number): Promise<MonitoringReport> {
    const heartbeat = await this.recordHeartbeat(state)
    const uptimeSeconds = Math.round(heartbeat.uptime / 1000)
    const avgCycleTime = state.totalLoops > 0 ? Math.round(heartbeat.uptime / state.totalLoops) : 0

    const { data: recentErrors } = await this.supabase
      .from('execution_logs')
      .select('id')
      .eq('user_id', this.userId)
      .eq('module', 'night_shift')
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 86400000).toISOString())

    return {
      daemonId: this.daemonId,
      uptime: uptimeSeconds,
      totalLoops: state.totalLoops,
      goalsCompleted,
      goalsFailed,
      branchesCreated: 0,
      prsMerged: 0,
      rollbacksPerformed: 0,
      errorsLast24h: (recentErrors ?? []).length,
      avgCycleTime,
      healthScore: this.getHealthScore(),
      alerts: [],
      metrics: heartbeat.metrics,
    }
  }

  getConsecutiveErrors(): number { return this.consecutiveErrors }
  resetConsecutiveErrors(): void { this.consecutiveErrors = 0 }
  getHealthScore(): number {
    const errorPenalty = Math.min(this.consecutiveErrors * 10, 60)
    const uptimeBonus = Math.min(Math.floor((Date.now() - this.startTime) / 60000), 40)
    return Math.max(0, Math.min(100, 70 - errorPenalty + uptimeBonus))
  }

  private collectMetrics(state: DaemonState): HealthMetric[] {
    const uptimeSeconds = Math.round((Date.now() - this.startTime) / 1000)
    return [
      {
        name: 'uptime_seconds', value: uptimeSeconds, unit: 's',
        status: uptimeSeconds > 3600 ? 'ok' : uptimeSeconds > 300 ? 'warning' : 'critical',
        threshold: 3600, measuredAt: new Date().toISOString(),
      },
      {
        name: 'loop_count', value: state.totalLoops, unit: 'loops',
        status: 'ok', threshold: 0, measuredAt: new Date().toISOString(),
      },
      {
        name: 'consecutive_errors', value: this.consecutiveErrors, unit: 'errors',
        status: this.consecutiveErrors === 0 ? 'ok' : this.consecutiveErrors < 3 ? 'warning' : 'critical',
        threshold: 3, measuredAt: new Date().toISOString(),
      },
      {
        name: 'health_score', value: this.getHealthScore(), unit: '%',
        status: this.getHealthScore() >= 70 ? 'ok' : this.getHealthScore() >= 40 ? 'warning' : 'critical',
        threshold: 70, measuredAt: new Date().toISOString(),
      },
      {
        name: 'daemon_status', value: state.status === 'running' ? 1 : 0, unit: 'running',
        status: state.status === 'running' ? 'ok' : 'critical',
        threshold: 1, measuredAt: new Date().toISOString(),
      },
    ]
  }
}
