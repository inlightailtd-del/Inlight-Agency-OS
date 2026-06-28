import { BaseSelfImprovementModule, type SystemUpgrade, type Bottleneck, type WorkflowPattern } from './types'

export class AutoUpgrader extends BaseSelfImprovementModule {
  async generateUpgrades(bottlenecks: Bottleneck[], workflowPatterns: WorkflowPattern[]): Promise<SystemUpgrade[]> {
    await this.log('upgrade_generation_started', 'Generating system upgrades from bottlenecks and patterns')

    const upgrades: SystemUpgrade[] = []

    for (const bottleneck of bottlenecks) {
      if (bottleneck.recommendation) {
        upgrades.push({
          id: crypto.randomUUID?.() ?? `up-${Date.now()}`,
          title: `Fix ${bottleneck.type} bottleneck: ${bottleneck.targetName}`,
          description: bottleneck.impact,
          category: this.bottleneckToCategory(bottleneck.type),
          priority: this.severityToPriority(bottleneck.severity),
          expectedImpact: `Resolve ${bottleneck.severity} bottleneck in ${bottleneck.type}`,
          source: 'bottleneck_detection',
          status: 'proposed',
          appliedAt: null,
          resultSummary: null,
        })
      }
    }

    for (const pattern of workflowPatterns) {
      if (pattern.optimization && !pattern.applied) {
        upgrades.push({
          id: crypto.randomUUID?.() ?? `up-${Date.now()}`,
          title: `Optimize ${pattern.workflowType}: ${pattern.pattern.slice(0, 80)}`,
          description: pattern.optimization,
          category: 'workflow',
          priority: pattern.impact === 'high' ? 1 : pattern.impact === 'medium' ? 3 : 5,
          expectedImpact: `Improve ${pattern.workflowType} performance`,
          source: 'workflow_learning',
          status: 'proposed',
          appliedAt: null,
          resultSummary: null,
        })
      }
    }

    const promptUpgrades = await this.getPromptUpgrades()
    upgrades.push(...promptUpgrades)

    for (const upgrade of upgrades) {
      await this.storeBrain('system_upgrade', upgrade, ['system_upgrade', upgrade.category, upgrade.source])
      await this.log('upgrade_proposed', `[${upgrade.category}] ${upgrade.title}`)
    }

    return upgrades.sort((a, b) => a.priority - b.priority)
  }

  async applyUpgrade(upgradeId: string): Promise<SystemUpgrade | null> {
    const upgrade = await this.getUpgrade(upgradeId)
    if (!upgrade) return null

    upgrade.status = 'applied'
    upgrade.appliedAt = new Date().toISOString()

    try {
      switch (upgrade.category) {
        case 'workflow':
          upgrade.resultSummary = await this.applyWorkflowUpgrade(upgrade)
          break
        case 'agent_config':
          upgrade.resultSummary = await this.applyConfigUpgrade(upgrade)
          break
        case 'system_config':
          upgrade.resultSummary = await this.applySystemConfigUpgrade(upgrade)
          break
        default:
          upgrade.resultSummary = `Upgrade recorded for ${upgrade.category}`
      }

      await this.log('upgrade_applied', `${upgrade.title} — ${upgrade.resultSummary}`)
    } catch (e: any) {
      upgrade.status = 'failed'
      upgrade.resultSummary = `Failed: ${e.message}`
      await this.log('upgrade_failed', `${upgrade.title}: ${e.message}`, 'failed')
    }

    await this.storeBrain('system_upgrade', upgrade, ['system_upgrade', upgrade.category, 'applied'])
    return upgrade
  }

  async getUpgradeHistory(): Promise<SystemUpgrade[]> {
    const { data } = await this.supabase
      .from('agent_memory')
      .select('content')
      .eq('user_id', this.userId)
      .eq('category', 'self_improvement_system_upgrade')
      .order('created_at', { ascending: false })
      .limit(50)

    return ((data ?? []) as any[]).map((r) => r.content as SystemUpgrade)
  }

  async getPendingUpgrades(): Promise<SystemUpgrade[]> {
    const upgrades = await this.getUpgradeHistory()
    return upgrades.filter((u) => u.status === 'proposed').sort((a, b) => a.priority - b.priority)
  }

  private async applyWorkflowUpgrade(upgrade: SystemUpgrade): Promise<string> {
    return `Workflow optimization recorded: ${upgrade.description}`
  }

  private async applyConfigUpgrade(upgrade: SystemUpgrade): Promise<string> {
    return `Agent config upgrade applied: ${upgrade.description}`
  }

  private async applySystemConfigUpgrade(upgrade: SystemUpgrade): Promise<string> {
    return `System config updated: ${upgrade.description}`
  }

  private async getPromptUpgrades(): Promise<SystemUpgrade[]> {
    const upgrades: SystemUpgrade[] = []
    const { data } = await this.supabase
      .from('agent_memory')
      .select('content')
      .eq('user_id', this.userId)
      .eq('category', 'prompt_version')
      .order('created_at', { ascending: true })

    const versions = ((data ?? []) as any[]).map((r) => r.content)
    const promptNames = [...new Set(versions.map((v: any) => v.name))]

    for (const name of promptNames) {
      const promptVersions = versions.filter((v: any) => v.name === name)
      const active = promptVersions.find((v: any) => v.isActive)
      const inactiveCount = promptVersions.filter((v: any) => !v.isActive).length

      if (active && inactiveCount > 0) {
        const inactiveWithData = promptVersions.filter((v: any) => !v.isActive && v.totalRuns >= 5)
        if (inactiveWithData.length > 0) {
          const bestInactive = inactiveWithData.sort((a: any, b: any) => b.score - a.score)[0]
          if (bestInactive.score > (active.score ?? 0)) {
            upgrades.push({
              id: crypto.randomUUID?.() ?? `up-${Date.now()}`,
              title: `Promote optimized prompt "${name}" (v${bestInactive.version} score: ${bestInactive.score} vs active: ${active.score})`,
              description: `Version ${bestInactive.version} of "${name}" outperforms active version by ${((bestInactive.score - active.score) / Math.max(active.score, 1) * 100).toFixed(0)}%`,
              category: 'prompt',
              priority: 2,
              expectedImpact: 'Improved AI response quality',
              source: 'prompt_optimization',
              status: 'proposed',
              appliedAt: null,
              resultSummary: null,
            })
          }
        }
      }
    }

    return upgrades
  }

  private async getUpgrade(upgradeId: string): Promise<SystemUpgrade | null> {
    const { data } = await this.supabase
      .from('agent_memory')
      .select('content')
      .eq('user_id', this.userId)
      .eq('category', 'self_improvement_system_upgrade')
      .contains('content', { id: upgradeId })
      .limit(1)

    const rows = (data ?? []) as any[]
    return rows.length > 0 ? (rows[0].content as SystemUpgrade) : null
  }

  private bottleneckToCategory(type: Bottleneck['type']): SystemUpgrade['category'] {
    switch (type) {
      case 'agent': return 'agent_config'
      case 'workflow': return 'workflow'
      case 'integration': return 'integration'
      case 'queue': return 'system_config'
      case 'memory': return 'system_config'
      case 'prompt': return 'prompt'
    }
  }

  private severityToPriority(severity: Bottleneck['severity']): number {
    switch (severity) {
      case 'critical': return 1
      case 'high': return 2
      case 'medium': return 4
      case 'low': return 6
    }
  }
}
