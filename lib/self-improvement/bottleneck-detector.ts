import { BaseSelfImprovementModule, type Bottleneck, BOTTLENECK_THRESHOLDS } from './types'

export class BottleneckDetector extends BaseSelfImprovementModule {
  async detectAll(): Promise<Bottleneck[]> {
    await this.log('bottleneck_detection_started', 'Scanning for system bottlenecks')
    const bottlenecks: Bottleneck[] = []

    const agentBottlenecks = await this.detectAgentBottlenecks()
    bottlenecks.push(...agentBottlenecks)

    const workflowBottlenecks = await this.detectWorkflowBottlenecks()
    bottlenecks.push(...workflowBottlenecks)

    const queueBottlenecks = await this.detectQueueBottlenecks()
    bottlenecks.push(...queueBottlenecks)

    const integrationBottlenecks = await this.detectIntegrationBottlenecks()
    bottlenecks.push(...integrationBottlenecks)

    for (const b of bottlenecks) {
      const { data: existing } = await this.supabase
        .from('agent_memory')
        .select('id')
        .eq('user_id', this.userId)
        .eq('category', 'self_improvement_bottleneck')
        .contains('content', { type: b.type, targetId: b.targetId, status: 'open' })
        .limit(1)

      if (!existing?.length) {
        await this.storeBrain('bottleneck', b, ['bottleneck', b.type, b.severity])
        await this.log('bottleneck_detected', `[${b.severity}] ${b.type}: ${b.targetName} — ${b.impact}`)
      }
    }

    await this.log('bottleneck_detection_completed', `Found ${bottlenecks.length} bottlenecks (${bottlenecks.filter((b) => b.severity === 'critical').length} critical)`)
    return bottlenecks
  }

  async getOpenBottlenecks(severity?: string): Promise<Bottleneck[]> {
    const { data } = await this.supabase
      .from('agent_memory')
      .select('content')
      .eq('user_id', this.userId)
      .eq('category', 'self_improvement_bottleneck')

    let results = ((data ?? []) as any[]).map((r) => r.content as Bottleneck).filter((b) => b.status === 'open')
    if (severity) results = results.filter((b) => b.severity === severity)
    return results.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 }
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4)
    })
  }

  async resolveBottleneck(bottleneckId: string, resolution?: string): Promise<void> {
    const { data } = await this.supabase
      .from('agent_memory')
      .select('id, content')
      .eq('user_id', this.userId)
      .eq('category', 'self_improvement_bottleneck')
      .contains('content', { id: bottleneckId })

    for (const row of ((data ?? []) as any[])) {
      const content = row.content as Bottleneck
      content.status = 'resolved'
      content.resolvedAt = new Date().toISOString()
      content.recommendation = resolution ?? content.recommendation
      await this.supabase.from('agent_memory').update({ content }).eq('id', row.id)
    }

    await this.log('bottleneck_resolved', `Bottleneck ${bottleneckId} resolved: ${resolution ?? 'auto-resolved'}`)
  }

  private async detectAgentBottlenecks(): Promise<Bottleneck[]> {
    const bottlenecks: Bottleneck[] = []
    const { data: agents } = await this.supabase
      .from('agents')
      .select('id, name, type, performance_score, success_rate, status')
      .eq('user_id', this.userId)

    const agentList = (agents ?? []) as any[]
    for (const agent of agentList) {
      if (agent.success_rate < BOTTLENECK_THRESHOLDS.agentSuccessRate) {
        bottlenecks.push({
          id: crypto.randomUUID?.() ?? `b-${Date.now()}`,
          type: 'agent',
          targetId: agent.id,
          targetName: `${agent.name} (${agent.type})`,
          severity: agent.success_rate < 40 ? 'critical' : 'high',
          metric: 'success_rate',
          currentValue: agent.success_rate,
          thresholdValue: BOTTLENECK_THRESHOLDS.agentSuccessRate,
          impact: `Agent success rate ${agent.success_rate}% — below ${BOTTLENECK_THRESHOLDS.agentSuccessRate}% threshold`,
          recommendation: 'Review error patterns, provide retraining, adjust autonomy level',
          status: 'open',
          detectedAt: new Date().toISOString(),
          resolvedAt: null,
        })
      }
      if (agent.status === 'busy' || agent.status === 'error') {
        bottlenecks.push(this.makeBottleneck('agent', agent.id, `${agent.name} stuck in "${agent.status}" status`, 'medium', 'status', 0, 1, 'Agent not available for task assignment'))
      }
    }
    return bottlenecks
  }

  private async detectWorkflowBottlenecks(): Promise<Bottleneck[]> {
    const bottlenecks: Bottleneck[] = []
    const { data: executions } = await this.supabase
      .from('agent_executions')
      .select('duration_ms, status, metadata')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(100)

    const execs = (executions ?? []) as any[]
    const longRunning = execs.filter((e) => e.duration_ms > BOTTLENECK_THRESHOLDS.workflowDurationMs)
    if (longRunning.length > 3) {
      bottlenecks.push(this.makeBottleneck(
        'workflow', 'execution_pipeline', `${longRunning.length}/${execs.length} executions exceed ${BOTTLENECK_THRESHOLDS.workflowDurationMs}ms`,
        longRunning.length > 10 ? 'high' : 'medium', 'avg_duration',
        Math.round(longRunning.reduce((s, e) => s + e.duration_ms, 0) / longRunning.length),
        BOTTLENECK_THRESHOLDS.workflowDurationMs,
        'Long execution times slowing down pipeline'
      ))
    }
    return bottlenecks
  }

  private async detectQueueBottlenecks(): Promise<Bottleneck[]> {
    const bottlenecks: Bottleneck[] = []
    const { data: queueJobs } = await this.supabase
      .from('job_queue')
      .select('id')
      .eq('user_id', this.userId)
      .eq('status', 'pending')

    const queueDepth = (queueJobs ?? []).length
    if (queueDepth > BOTTLENECK_THRESHOLDS.queueDepth) {
      bottlenecks.push(this.makeBottleneck(
        'queue', 'job_queue', `Queue depth ${queueDepth} — exceeds ${BOTTLENECK_THRESHOLDS.queueDepth} threshold`,
        queueDepth > 50 ? 'critical' : 'high', 'queue_depth', queueDepth,
        BOTTLENECK_THRESHOLDS.queueDepth,
        'Backlog of pending jobs — increase worker capacity'
      ))
    }
    return bottlenecks
  }

  private async detectIntegrationBottlenecks(): Promise<Bottleneck[]> {
    const bottlenecks: Bottleneck[] = []
    const { data: healthLogs } = await this.supabase
      .from('integration_health_logs')
      .select('provider, status')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(100)

    const logs = (healthLogs ?? []) as any[]
    const byProvider: Record<string, { total: number; failed: number }> = {}
    for (const log of logs) {
      if (!byProvider[log.provider]) byProvider[log.provider] = { total: 0, failed: 0 }
      byProvider[log.provider].total++
      if (log.status === 'error' || log.status === 'failed') byProvider[log.provider].failed++
    }

    for (const [provider, stats] of Object.entries(byProvider)) {
      const failureRate = stats.failed / stats.total
      if (failureRate > BOTTLENECK_THRESHOLDS.integrationFailureRate && stats.total > 5) {
        bottlenecks.push(this.makeBottleneck(
          'integration', provider, `${provider}: ${(failureRate * 100).toFixed(0)}% failure rate`,
          failureRate > 0.3 ? 'critical' : 'high', 'failure_rate',
          Math.round(failureRate * 100), Math.round(BOTTLENECK_THRESHOLDS.integrationFailureRate * 100),
          `High integration failure rate — check credentials and API status`
        ))
      }
    }
    return bottlenecks
  }

  private makeBottleneck(
    type: Bottleneck['type'], targetId: string, targetName: string,
    severity: Bottleneck['severity'], metric: string,
    currentValue: number, thresholdValue: number, impact: string
  ): Bottleneck {
    return {
      id: crypto.randomUUID?.() ?? `b-${Date.now()}`,
      type, targetId, targetName, severity, metric,
      currentValue, thresholdValue, impact,
      recommendation: null,
      status: 'open',
      detectedAt: new Date().toISOString(),
      resolvedAt: null,
    }
  }
}
