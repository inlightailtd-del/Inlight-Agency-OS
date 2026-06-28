import type { SupabaseClient } from '@supabase/supabase-js'
import type { DaemonState, DaemonConfig, DaemonStatus, Heartbeat } from './types'
import { DEFAULT_DAEMON_CONFIG } from './types'
import { NightShiftMonitor } from './monitoring'

export class NightShiftDaemon {
  private state: DaemonState
  private monitor: NightShiftMonitor
  private loopTimer: ReturnType<typeof setInterval> | null = null
  private healthTimer: ReturnType<typeof setInterval> | null = null
  private onCycle: (() => Promise<void>) | null = null
  private startTime: number = 0

  constructor(
    private supabase: SupabaseClient,
    private userId: string,
    config?: Partial<DaemonConfig>
  ) {
    const daemonConfig: DaemonConfig = { ...DEFAULT_DAEMON_CONFIG, ...config }
    this.state = {
      id: crypto.randomUUID?.() ?? `daemon-${Date.now()}`,
      status: 'idle',
      startedAt: null,
      currentLoop: 0,
      totalLoops: 0,
      lastHeartbeat: null,
      errors: [],
      pid: null,
      mode: 'auto',
      config: daemonConfig,
    }
    this.monitor = new NightShiftMonitor(supabase, userId, this.state.id)
  }

  onLoop(handler: () => Promise<void>): void {
    this.onCycle = handler
  }

  async start(): Promise<DaemonState> {
    if (this.state.status === 'running') return this.state

    this.startTime = Date.now()
    this.state.status = 'running'
    this.state.startedAt = new Date().toISOString()
    this.state.currentLoop = 0
    this.state.errors = []

    await this.log('daemon_started', `Daemon started with ${this.state.config.loopIntervalMs}ms interval`)

    this.loopTimer = setInterval(async () => {
      await this.runLoop()
    }, this.state.config.loopIntervalMs)

    this.healthTimer = setInterval(async () => {
      await this.heartbeat()
    }, this.state.config.healthCheckIntervalMs)

    await this.heartbeat()
    return this.state
  }

  async stop(): Promise<DaemonState> {
    this.state.status = 'stopped'
    if (this.loopTimer) { clearInterval(this.loopTimer); this.loopTimer = null }
    if (this.healthTimer) { clearInterval(this.healthTimer); this.healthTimer = null }

    await this.monitor.recordHeartbeat(this.state)
    await this.log('daemon_stopped', `Daemon stopped after ${this.state.totalLoops} loops`)

    return this.state
  }

  async pause(): Promise<DaemonState> {
    this.state.status = 'paused'
    if (this.loopTimer) { clearInterval(this.loopTimer); this.loopTimer = null }
    await this.log('daemon_paused', 'Daemon paused')
    return this.state
  }

  async resume(): Promise<DaemonState> {
    if (this.state.status !== 'paused') return this.state
    this.state.status = 'running'
    this.loopTimer = setInterval(async () => {
      await this.runLoop()
    }, this.state.config.loopIntervalMs)
    await this.log('daemon_resumed', 'Daemon resumed')
    return this.state
  }

  getState(): DaemonState { return this.state }
  getMonitor(): NightShiftMonitor { return this.monitor }

  async setConfig(config: Partial<DaemonConfig>): Promise<void> {
    this.state.config = { ...this.state.config, ...config }
    await this.log('daemon_config_updated', `Config updated: ${JSON.stringify(config)}`)
  }

  private async runLoop(): Promise<void> {
    if (this.state.status !== 'running') return
    this.state.currentLoop++
    this.state.totalLoops++

    try {
      if (this.onCycle) {
        await this.onCycle()
      }
      this.monitor.resetConsecutiveErrors()
    } catch (e: any) {
      this.state.errors.push(e.message)
      await this.monitor.recordError('loop_cycle', e.message)

      if (this.monitor.getConsecutiveErrors() >= this.state.config.maxConsecutiveErrors) {
        this.state.status = 'error'
        await this.log('daemon_error', `Max consecutive errors (${this.state.config.maxConsecutiveErrors}) reached: ${e.message}`, 'failed')
        if (this.state.config.autoRollbackEnabled) {
          await this.log('daemon_auto_rollback', 'Auto-rollback triggered by daemon error')
        }
      }
    }
  }

  private async heartbeat(): Promise<void> {
    const heartbeat = await this.monitor.recordHeartbeat(this.state)
    this.state.lastHeartbeat = heartbeat.timestamp
  }

  private async log(action: string, message: string, status = 'success'): Promise<void> {
    try {
      await this.supabase.from('execution_logs').insert([{
        user_id: this.userId,
        command_id: null,
        action: `[NightShift] ${action}`,
        module: 'night_shift',
        entity_type: 'daemon',
        status,
        message,
      }])
    } catch { /* best effort */ }
  }
}
