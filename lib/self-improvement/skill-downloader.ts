import { BaseSelfImprovementModule, type SkillDownload } from './types'

export class SkillDownloader extends BaseSelfImprovementModule {
  async scanForSkillGaps(): Promise<{ agentId: string; agentType: string; missingSkills: string[]; priority: number }[]> {
    await this.log('skill_gap_scan_started', 'Scanning all agents for skill gaps')

    const { data: agents } = await this.supabase
      .from('agents')
      .select('id, type, department, skills, performance_score, success_rate')
      .eq('user_id', this.userId)

    const agentList = (agents ?? []) as any[]
    const departmentSkills = await this.getDepartmentSkillRequirements()
    const gaps: { agentId: string; agentType: string; missingSkills: string[]; priority: number }[] = []

    for (const agent of agentList) {
      const required = departmentSkills[agent.department] ?? []
      const currentSkills = agent.skills ?? []
      const missing = required.filter((s: string) => !currentSkills.includes(s))

      if (missing.length > 0) {
        const priority = Math.min(missing.length + (100 - (agent.performance_score ?? 50)) / 20, 10)
        gaps.push({
          agentId: agent.id,
          agentType: agent.type,
          missingSkills: missing,
          priority: Math.round(priority),
        })
      }
    }

    await this.log('skill_gap_scan_completed', `Found gaps in ${gaps.length} agents`)
    return gaps.sort((a, b) => b.priority - a.priority)
  }

  async downloadSkill(agentId: string, skillName: string): Promise<SkillDownload> {
    const agent = await this.getAgent(agentId)
    const download: SkillDownload = {
      id: crypto.randomUUID?.() ?? `${Date.now()}`,
      skillName,
      agentId,
      agentType: agent?.type ?? 'unknown',
      source: 'self_improvement',
      priority: 5,
      status: 'queued',
      completedAt: null,
      durationMs: null,
    }

    await this.storeBrain('skill_download', download, ['skill_download', skillName, agent?.type].filter(Boolean))

    const startTime = Date.now()
    download.status = 'downloading'
    await this.log('skill_download_started', `Downloading skill "${skillName}" for agent ${agentId}`)

    try {
      const currentSkills = agent?.skills ?? []
      if (!currentSkills.includes(skillName)) {
        const updatedSkills = [...currentSkills, skillName]
        await this.supabase.from('agents').update({
          skills: updatedSkills,
          training_count: (agent?.training_count ?? 0) + 1,
          last_trained_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', agentId)
      }

      download.status = 'completed'
      download.durationMs = Date.now() - startTime
      download.completedAt = new Date().toISOString()

      await this.log('skill_download_completed', `Skill "${skillName}" downloaded for agent ${agentId} in ${download.durationMs}ms`)
    } catch (e: any) {
      download.status = 'failed'
      download.durationMs = Date.now() - startTime
      await this.log('skill_download_failed', `Failed to download "${skillName}": ${e.message}`, 'failed')
    }

    return download
  }

  async autoDownloadSkills(maxDownloads = 5): Promise<SkillDownload[]> {
    const gaps = await this.scanForSkillGaps()
    const results: SkillDownload[] = []
    let count = 0

    for (const gap of gaps) {
      if (count >= maxDownloads) break
      for (const skill of gap.missingSkills) {
        if (count >= maxDownloads) break
        const result = await this.downloadSkill(gap.agentId, skill)
        results.push(result)
        count++
      }
    }

    return results
  }

  async getSkillLibrary(): Promise<{ department: string; skills: string[] }[]> {
    const { data } = await this.supabase
      .from('agent_memory')
      .select('content')
      .eq('user_id', this.userId)
      .eq('category', 'self_improvement_skill_download')
      .order('created_at', { ascending: false })

    const downloaded = new Set<string>()
    for (const row of ((data ?? []) as any[])) {
      const content = row.content as SkillDownload
      if (content.status === 'completed') downloaded.add(content.skillName)
    }

    return [
      { department: 'sales', skills: ['lead_generation', 'outreach', 'proposal_writing', 'client_communication', 'cold_calling', 'demo_scheduling', 'negotiation'] },
      { department: 'marketing', skills: ['content_marketing', 'social_media', 'seo', 'campaign_management', 'email_marketing', 'brand_strategy'] },
      { department: 'content', skills: ['blog_writing', 'copywriting', 'editing', 'content_strategy', 'video_scripting', 'storytelling'] },
      { department: 'development', skills: ['frontend', 'backend', 'fullstack', 'devops', 'mobile', 'ai_ml'] },
      { department: 'operations', skills: ['workflow_automation', 'project_management', 'quality_assurance', 'process_optimization', 'resource_planning'] },
      { department: 'finance', skills: ['invoicing', 'expense_tracking', 'financial_reporting', 'budgeting', 'forecasting'] },
    ].map((dept) => ({
      ...dept,
      skills: dept.skills.map((s) => downloaded.has(s) ? `${s} ✓` : s),
    }))
  }

  private async getAgent(agentId: string): Promise<any | null> {
    const { data } = await this.supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single()
    return data ?? null
  }

  private async getDepartmentSkillRequirements(): Promise<Record<string, string[]>> {
    const deptSpecializations: Record<string, string[]> = {
      sales: ['lead_generation', 'outreach', 'proposal_writing', 'client_communication', 'cold_calling', 'demo_scheduling', 'negotiation'],
      marketing: ['content_marketing', 'social_media', 'seo', 'campaign_management', 'email_marketing', 'brand_strategy'],
      content: ['blog_writing', 'copywriting', 'editing', 'content_strategy', 'video_scripting', 'storytelling'],
      development: ['frontend', 'backend', 'fullstack', 'devops', 'mobile', 'ai_ml'],
      operations: ['workflow_automation', 'project_management', 'quality_assurance', 'process_optimization', 'resource_planning'],
      finance: ['invoicing', 'expense_tracking', 'financial_reporting', 'budgeting', 'forecasting'],
      design: ['ui_design', 'ux_design', 'graphic_design', 'motion_design', 'brand_design'],
      hr: ['recruiting', 'onboarding', 'training', 'payroll', 'culture'],
    }

    const { data: existingDownloads } = await this.supabase
      .from('agent_memory')
      .select('content')
      .eq('user_id', this.userId)
      .eq('category', 'self_improvement_skill_download')

    const downloadedSkills = new Set<string>()
    for (const row of ((existingDownloads ?? []) as any[])) {
      const c = row.content as SkillDownload
      if (c.status === 'completed') downloadedSkills.add(c.skillName)
    }

    const result: Record<string, string[]> = {}
    for (const [dept, skills] of Object.entries(deptSpecializations)) {
      result[dept] = skills.filter((s) => !downloadedSkills.has(s))
    }
    return result
  }
}
