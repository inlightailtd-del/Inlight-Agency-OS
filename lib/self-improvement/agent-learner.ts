import { BaseSelfImprovementModule, type AgentKnowledge } from './types'

export class AgentLearner extends BaseSelfImprovementModule {
  async analyzeAllAgents(): Promise<AgentKnowledge[]> {
    await this.log('agent_learning_analysis_started', 'Analyzing all agent performance and knowledge')

    const { data: agents } = await this.supabase
      .from('agents')
      .select('*')
      .eq('user_id', this.userId)

    const agentList = (agents ?? []) as any[]
    const results: AgentKnowledge[] = []

    for (const agent of agentList) {
      const knowledge = await this.buildAgentKnowledge(agent)
      results.push(knowledge)

      if (knowledge.weaknesses.length > 0) {
        await this.storeBrain('agent_knowledge', knowledge, ['agent_knowledge', agent.type, agent.department].filter(Boolean))
      }
    }

    await this.crossTrain(results)
    await this.log('agent_learning_analysis_completed', `Analyzed ${results.length} agents`)

    return results
  }

  async crossTrain(agents: AgentKnowledge[]): Promise<number> {
    let transfers = 0
    const highPerformers = agents.filter((a) => a.performanceScore >= 80)
    const lowPerformers = agents.filter((a) => a.performanceScore < 60)

    for (const low of lowPerformers) {
      const mentors = highPerformers.filter(
        (h) => (h.agentType === low.agentType || h.department === low.department) && h.agentId !== low.agentId
      )

      for (const mentor of mentors) {
        const newSkills = mentor.strengths.filter((s) => !low.skills.includes(s) && !low.weaknesses.includes(s))
        if (newSkills.length > 0) {
          for (const skill of newSkills.slice(0, 2)) {
            await this.transferKnowledge(mentor.agentId, low.agentId, skill)
            transfers++
          }
        }

        const mentorPatterns = mentor.learnings.filter((l) => l.applied)
        for (const pattern of mentorPatterns.slice(0, 3)) {
          await this.storeBrain('knowledge_transfer', {
            fromAgent: mentor.agentId,
            toAgent: low.agentId,
            pattern: pattern.pattern,
            source: pattern.source,
          }, ['knowledge_transfer', mentor.agentType, low.agentType])
          transfers++
        }
      }
    }

    return transfers
  }

  async getAgentCurriculum(agentId: string): Promise<{ current: AgentKnowledge | null; recommendations: string[] }> {
    const { data: agents } = await this.supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .limit(1)

    const agentList = (agents ?? []) as any[]
    if (agentList.length === 0) return { current: null, recommendations: [] }

    const knowledge = await this.buildAgentKnowledge(agentList[0])
    const recommendations: string[] = []

    if (knowledge.successRate < 70) recommendations.push('Improve success rate — review error patterns, add validation')
    if (knowledge.performanceScore < 60) recommendations.push('Boost performance score — complete training programs, focus on weak areas')
    if (knowledge.strengths.length < 3) recommendations.push('Develop core strengths — specialize in 1-2 high-value skills')
    if (knowledge.weaknesses.length > 2) recommendations.push('Address key weaknesses — targeted training on weak areas')
    if (knowledge.knowledgeAge > 30) recommendations.push('Refresh knowledge — recent patterns and learnings may have evolved')

    return { current: knowledge, recommendations }
  }

  async recommendLearningPath(agentType: string, department: string | null): Promise<{ skill: string; priority: number }[]> {
    const { data: allAgentsData } = await this.supabase
      .from('agents')
      .select('*')
      .eq('user_id', this.userId)

    const allAgents = (allAgentsData ?? []) as any[]
    const sameType = allAgents.filter((a) => a.type === agentType)
    const highPerformer = sameType.sort((a, b) => b.performance_score - a.performance_score)[0]
    const lowPerformers = sameType.filter((a) => a.performance_score < 60)

    const gaps: { skill: string; priority: number }[] = []
    if (highPerformer) {
      const highSkills = highPerformer.skills || []
      for (const low of lowPerformers) {
        const lowSkills = low.skills || []
        for (const skill of highSkills) {
          if (!lowSkills.includes(skill)) {
            const existing = gaps.find((g) => g.skill === skill)
            if (existing) existing.priority++
            else gaps.push({ skill, priority: 1 })
          }
        }
      }
    }

    return gaps.sort((a, b) => b.priority - a.priority)
  }

  private async buildAgentKnowledge(agent: any): Promise<AgentKnowledge> {
    const { data: learnings } = await this.supabase
      .from('agent_memory')
      .select('content')
      .eq('user_id', this.userId)
      .eq('agent_id', agent.id)
      .in('category', ['self_improvement_agent_knowledge', 'employee_learning', 'workflow_output'])
      .order('created_at', { ascending: false })
      .limit(20)

    const learningItems = ((learnings ?? []) as any[]).map((r) => r.content)
    const extractPatterns = (items: any[]) => items.filter((i) => i?.pattern).map((i) => ({ pattern: i.pattern, source: i.source || 'execution', applied: i.applied || false }))

    return {
      agentId: agent.id,
      agentType: agent.type,
      department: agent.department ?? null,
      skills: agent.skills ?? [],
      strengths: this.inferStrengths(agent),
      weaknesses: this.inferWeaknesses(agent),
      performanceScore: agent.performance_score ?? 50,
      successRate: agent.success_rate ?? 50,
      learnings: extractPatterns(learningItems),
      knowledgeAge: agent.last_trained_at ? Math.round((Date.now() - new Date(agent.last_trained_at).getTime()) / 86400000) : 999,
    }
  }

  private inferStrengths(agent: any): string[] {
    const s: string[] = []
    if (agent.performance_score >= 80) s.push('High performer')
    if (agent.success_rate >= 85) s.push('Reliable executor')
    if ((agent.skills?.length ?? 0) >= 5) s.push('Multi-skilled')
    if (agent.level >= 4) s.push('Senior expertise')
    if (agent.total_executions > 50) s.push('Experienced')
    return s
  }

  private inferWeaknesses(agent: any): string[] {
    const w: string[] = []
    if (agent.performance_score < 60) w.push('Low performance score')
    if (agent.success_rate < 70) w.push('Low success rate')
    if ((agent.skills?.length ?? 0) < 3) w.push('Limited skill set')
    if (agent.level < 2) w.push('Junior level — needs development')
    if (agent.total_executions < 10) w.push('Inexperienced — needs more practice')
    return w
  }

  private async transferKnowledge(fromAgent: string, toAgent: string, skill: string): Promise<void> {
    await this.supabase.from('agent_memory').insert([{
      user_id: this.userId,
      agent_id: toAgent,
      category: 'knowledge_transfer',
      content: {
        fromAgent,
        skill,
        transferredAt: new Date().toISOString(),
        status: 'pending',
      },
      tags: ['knowledge_transfer', 'self_improvement'],
    }])
  }
}
