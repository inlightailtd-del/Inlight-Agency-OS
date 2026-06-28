import { BaseSelfImprovementModule, type PromptVersion, type PromptTestResult, PROMPT_OPTIMIZATION_THRESHOLDS } from './types'

export class PromptOptimizer extends BaseSelfImprovementModule {
  async registerPrompt(params: {
    name: string
    systemPrompt: string
    userPromptTemplate?: string
    agentType: string
    model?: string
    tags?: string[]
    parentVersion?: number
  }): Promise<PromptVersion> {
    const lastVersion = await this.getLatestVersion(params.name)
    const version = lastVersion ? lastVersion.version + 1 : 1

    const { data, error } = await this.supabase.from('agent_memory').insert([{
      user_id: this.userId,
      agent_id: null,
      category: 'prompt_version',
      content: {
        name: params.name,
        version,
        systemPrompt: params.systemPrompt,
        userPromptTemplate: params.userPromptTemplate ?? null,
        agentType: params.agentType,
        model: params.model ?? null,
        tags: params.tags ?? [],
        score: 0,
        totalRuns: 0,
        successRate: 0,
        avgTokens: 0,
        avgDurationMs: 0,
        parentVersion: params.parentVersion ?? lastVersion?.version ?? null,
        isActive: version === 1,
        createdAt: new Date().toISOString(),
      },
      tags: ['prompt_version', params.agentType, params.name],
    }]).select('*').single()

    if (error) throw new Error(`Failed to register prompt: ${error.message}`)
    await this.log('prompt_registered', `"${params.name}" v${version} for ${params.agentType}`)
    return data?.content as PromptVersion
  }

  async recordRun(params: {
    promptName: string
    version: number
    success: boolean
    tokensUsed: number
    durationMs: number
    quality?: number
  }): Promise<void> {
    const version = await this.getVersion(params.promptName, params.version)
    if (!version) return

    const newTotal = version.totalRuns + 1
    const newSuccessRate = Math.round(((version.successRate * version.totalRuns + (params.success ? 100 : 0)) / newTotal) * 100) / 100
    const newAvgTokens = Math.round((version.avgTokens * version.totalRuns + params.tokensUsed) / newTotal)
    const newAvgDuration = Math.round((version.avgDurationMs * version.totalRuns + params.durationMs) / newTotal)
    const qualityBonus = (params.quality ?? 50) / 100
    const newScore = Math.round(newSuccessRate * 0.5 + (1 - newAvgTokens / 10000) * 0.2 + (1 - newAvgDuration / 30000) * 0.1 + qualityBonus * 0.2)

    const { data: existing } = await this.supabase
      .from('agent_memory')
      .select('id')
      .eq('user_id', this.userId)
      .eq('category', 'prompt_version')
      .contains('content', { name: params.promptName, version: params.version })
      .limit(1)

    if (existing?.length) {
      const content = await this.getVersion(params.promptName, params.version)
      if (content) {
        content.totalRuns = newTotal
        content.successRate = newSuccessRate
        content.avgTokens = newAvgTokens
        content.avgDurationMs = newAvgDuration
        content.score = newScore

        await this.supabase.from('agent_memory')
          .update({ content })
          .eq('id', existing[0].id)
      }
    }
  }

  async compareVersions(promptName: string): Promise<PromptTestResult[]> {
    const versions = await this.getAllVersions(promptName)
    return versions.map((v) => ({
      versionId: `${v.name}-v${v.version}`,
      runs: v.totalRuns,
      successRate: v.successRate,
      avgTokens: v.avgTokens,
      avgDurationMs: v.avgDurationMs,
      avgQuality: v.score,
      score: v.score,
    }))
  }

  async autoPromote(promptName: string): Promise<PromptVersion | null> {
    const versions = await this.getAllVersions(promptName)
    if (versions.length < 2) return null

    const active = versions.find((v) => v.isActive)
    const candidates = versions.filter((v) => !v.isActive && v.totalRuns >= PROMPT_OPTIMIZATION_THRESHOLDS.minRunsForComparison)

    if (!active || candidates.length === 0) return null

    let bestCandidate: PromptVersion | null = null
    let bestImprovement = 0

    for (const candidate of candidates) {
      const improvement = (candidate.score - active.score) / Math.max(active.score, 1)
      if (improvement > bestImprovement && improvement >= PROMPT_OPTIMIZATION_THRESHOLDS.autoPromoteThreshold) {
        bestImprovement = improvement
        bestCandidate = candidate
      }
    }

    if (bestCandidate) {
      await this.deactivateVersion(promptName, active.version)
      await this.activateVersion(promptName, bestCandidate.version)
      await this.log('prompt_auto_promoted',
        `"${promptName}" v${bestCandidate.version} promoted over v${active.version} (${(bestImprovement * 100).toFixed(0)}% better)`)

      await this.storeBrain('prompt_optimization', {
        promptName,
        promotedVersion: bestCandidate.version,
        previousVersion: active.version,
        improvement: bestImprovement,
        scores: { previous: active.score, new: bestCandidate.score },
      }, ['prompt_optimization', promptName])

      return bestCandidate
    }

    return null
  }

  async getActivePrompts(agentType?: string): Promise<PromptVersion[]> {
    let q = this.supabase
      .from('agent_memory')
      .select('*')
      .eq('user_id', this.userId)
      .eq('category', 'prompt_version')
      .contains('content', { isActive: true })

    if (agentType) q = q.overlaps('tags', [agentType])
    const { data } = await q
    return ((data ?? []) as any[]).map((r) => r.content as PromptVersion)
  }

  async optimizePrompt(promptName: string, currentPrompt: string, performance: { successRate: number; avgTokens: number; avgDurationMs: number }): Promise<string> {
    const optimized = currentPrompt

    if (performance.successRate < 60) {
      optimized.replace(/You are a[^.]+\./, 'You are a highly capable AI assistant with expertise in this domain.')
    }
    if (performance.avgDurationMs > 20000) {
      optimized.replace(/Be thorough/g, 'Be concise')
    }
    if (performance.avgTokens > 4000) {
      optimized.replace(/provide detailed/g, 'provide brief')
    }

    return optimized
  }

  private async getLatestVersion(name: string): Promise<PromptVersion | null> {
    const versions = await this.getAllVersions(name)
    return versions.length > 0 ? versions[versions.length - 1] : null
  }

  private async getVersion(name: string, version: number): Promise<PromptVersion | null> {
    const { data } = await this.supabase
      .from('agent_memory')
      .select('content')
      .eq('user_id', this.userId)
      .eq('category', 'prompt_version')
      .contains('content', { name, version })
      .limit(1)

    const rows = (data ?? []) as any[]
    return rows.length > 0 ? (rows[0].content as PromptVersion) : null
  }

  private async getAllVersions(name: string): Promise<PromptVersion[]> {
    const { data } = await this.supabase
      .from('agent_memory')
      .select('content')
      .eq('user_id', this.userId)
      .eq('category', 'prompt_version')
      .overlaps('tags', [name])

    return ((data ?? []) as any[])
      .map((r: any) => r.content as PromptVersion)
      .filter((v: PromptVersion) => v.name === name)
      .sort((a: PromptVersion, b: PromptVersion) => a.version - b.version)
  }

  private async deactivateVersion(name: string, version: number): Promise<void> {
    const { data: rows } = await this.supabase
      .from('agent_memory')
      .select('id, content')
      .eq('user_id', this.userId)
      .eq('category', 'prompt_version')
      .contains('content', { name, version })

    for (const row of (rows ?? []) as any[]) {
      const content = row.content as PromptVersion
      content.isActive = false
      await this.supabase.from('agent_memory').update({ content }).eq('id', row.id)
    }
  }

  private async activateVersion(name: string, version: number): Promise<void> {
    const { data: rows } = await this.supabase
      .from('agent_memory')
      .select('id, content')
      .eq('user_id', this.userId)
      .eq('category', 'prompt_version')
      .contains('content', { name, version })

    for (const row of (rows ?? []) as any[]) {
      const content = row.content as PromptVersion
      content.isActive = true
      await this.supabase.from('agent_memory').update({ content }).eq('id', row.id)
    }
  }
}
