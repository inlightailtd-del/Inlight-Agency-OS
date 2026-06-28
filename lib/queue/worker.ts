import type { SupabaseClient } from '@supabase/supabase-js'
import { dequeueNextJob, completeJob, failJob, updateJobProgress } from './queue'
import { executeAgentTask } from '@/lib/ai/execution'
import { runWorkflow } from '@/lib/ai/workflow'
import { generateContent } from '@/lib/ai/content-engine'
import { analyzeLead } from '@/lib/ai/lead-analyzer'
import { runCeoAssessment } from '@/lib/ceo/ceo'
import { runManagerAssessment, listDepartments } from '@/lib/ceo/manager'
import { runMorningBriefing, runEveningBriefing, runPnLAnalysis, runCashflowPrediction, runAutoBudgetSuggestions } from '@/lib/ceo/briefings'
import { runMeetingSimulation } from '@/lib/ceo/meeting-simulator'
import { generateVoiceReport } from '@/lib/ceo/voice-reports'
import { processRenderJob } from '@/lib/video/rendering-queue'

async function logQueueExecution(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  action: string,
  module: string,
  status: string,
  message: string
) {
  await supabase.from('execution_logs').insert([{
    user_id: userId,
    command_id: null,
    action: `[Queue] ${action}`,
    module,
    status,
    message: `Job ${jobId}: ${message}`,
    entity_type: 'job_queue',
    entity_id: jobId,
  }])
}

export async function processNextJob(supabase: SupabaseClient): Promise<{ processed: boolean; jobId?: string; status?: string; error?: string }> {
  const job = await dequeueNextJob(supabase)
  if (!job) return { processed: false }

  const startedAt = Date.now()

  try {
    await updateJobProgress(supabase, job.id, 25)

    switch (job.job_type) {
      case 'agent_execution': {
        const result = await executeAgentTask(
          supabase,
          job.user_id,
          job.payload.agent_id || null,
          job.payload.prompt || '',
          { systemPrompt: job.payload.systemPrompt, commandId: job.payload.command_id }
        )
        await updateJobProgress(supabase, job.id, 90)
        const execTimeMs = Date.now() - startedAt
        await supabase.from('job_queue').update({ execution_time_ms: execTimeMs }).eq('id', job.id)
        await completeJob(supabase, job.id, {
          response: result.response,
          status: result.status,
          tokens_used: result.tokens_used,
          duration_ms: result.duration_ms,
          execution_id: result.id,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Agent execution completed', 'agents', 'success', result.status)
        return { processed: true, jobId: job.id, status: result.status }
      }

      case 'workflow_execution': {
        const result = await runWorkflow(
          supabase,
          job.user_id,
          job.payload.workflow_id,
          job.payload.input || ''
        )
        await updateJobProgress(supabase, job.id, 90)
        const execTimeMs = Date.now() - startedAt
        await supabase.from('job_queue').update({ execution_time_ms: execTimeMs }).eq('id', job.id)
        await completeJob(supabase, job.id, {
          finalOutput: result.finalOutput,
          steps: result.steps,
          totalDurationMs: result.totalDurationMs,
          totalTokens: result.totalTokens,
          status: result.status,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Workflow execution completed', 'automations', 'success', result.status)
        return { processed: true, jobId: job.id, status: result.status }
      }

      case 'content_generation': {
        const result = await generateContent(
          supabase,
          job.user_id,
          job.payload.content_request_id,
          job.payload.params || {}
        )
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { content: result, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Content generation completed', 'content', 'success', '')
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'performance_optimization': {
        await updateJobProgress(supabase, job.id, 30)
        const { generatePerfReport } = await import('@/lib/perf/analyzer')
        const perfResult = await generatePerfReport(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          summary: perfResult.summary,
          bottlenecks: perfResult.bottlenecks.length,
          recommendations: perfResult.recommendations.length,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Performance optimization completed', 'agents', 'success', `${perfResult.recommendations.length} recommendations`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }


      case 'lead_processing': {
        const result = await analyzeLead(
          supabase,
          job.user_id,
          job.payload.lead_id
        )
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          score: result.score,
          analysis: result.analysis,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Lead analysis completed', 'clients', 'success', `Score: ${result.score}`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'automation_execution':
      case 'autonomous_agent': {
        // Future: autonomous agent runs
        await updateJobProgress(supabase, job.id, 50)
        const result = await executeAgentTask(
          supabase,
          job.user_id,
          null,
          job.payload.prompt || 'Execute autonomous task',
          { systemPrompt: job.payload.systemPrompt || 'You are an autonomous AI agent. Execute the task and report results.' }
        )
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          response: result.response,
          status: result.status,
          tokens_used: result.tokens_used,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, `${job.job_type} completed`, 'automations', 'success', result.status)
        return { processed: true, jobId: job.id, status: result.status }
      }

      case 'ceo_assessment': {
        await updateJobProgress(supabase, job.id, 30)
        const ceoResult = await runCeoAssessment(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          summary: ceoResult.summary,
          insights: ceoResult.insights,
          decisionsCount: ceoResult.decisions.length,
          successful: ceoResult.decisions.filter((d) => d.executed).length,
          failed: ceoResult.decisions.filter((d) => !d.executed).length,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'CEO assessment completed', 'agents', 'success', `${ceoResult.insights.length} insights, ${ceoResult.decisions.length} decisions`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'ceo_morning_briefing': {
        await updateJobProgress(supabase, job.id, 30)
        const morningResult = await runMorningBriefing(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          type: 'morning',
          summary: morningResult.summary,
          sections: morningResult.sections.length,
          actionItems: morningResult.actionItems.length,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Morning briefing completed', 'agents', 'success', `${morningResult.sections.length} sections, ${morningResult.actionItems.length} actions`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'ceo_evening_briefing': {
        await updateJobProgress(supabase, job.id, 30)
        const eveningResult = await runEveningBriefing(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          type: 'evening',
          summary: eveningResult.summary,
          sections: eveningResult.sections.length,
          actionItems: eveningResult.actionItems.length,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Evening briefing completed', 'agents', 'success', `${eveningResult.sections.length} sections, ${eveningResult.actionItems.length} actions`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'ceo_pnl_analysis': {
        await updateJobProgress(supabase, job.id, 30)
        const pnlResult = await runPnLAnalysis(supabase, job.user_id, job.payload.months || 3)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          period: pnlResult.period,
          revenue: pnlResult.revenue.total,
          expenses: pnlResult.expenses.total,
          profitMargin: pnlResult.profitMargin,
          insights: pnlResult.insights,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'P&L analysis completed', 'agents', 'success', `Margin: ${pnlResult.profitMargin}%, ${pnlResult.insights.length} insights`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'ceo_cashflow_prediction': {
        await updateJobProgress(supabase, job.id, 30)
        const cfResult = await runCashflowPrediction(supabase, job.user_id, job.payload.months || 6)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          currentBalance: cfResult.currentBalance,
          riskLevel: cfResult.riskLevel,
          projectedMonths: cfResult.netProjection.length,
          recommendations: cfResult.recommendations,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Cashflow prediction completed', 'agents', 'success', `Risk: ${cfResult.riskLevel}, ${cfResult.recommendations.length} recommendations`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'ceo_budget_suggestions': {
        await updateJobProgress(supabase, job.id, 30)
        const budgetResult = await runAutoBudgetSuggestions(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          suggestions: budgetResult.length,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Budget suggestions completed', 'agents', 'success', `${budgetResult.length} suggestions`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'ceo_meeting_simulation': {
        await updateJobProgress(supabase, job.id, 30)
        const meetingResult = await runMeetingSimulation(supabase, job.user_id, job.payload.meeting_type || 'board')
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          title: meetingResult.title,
          type: meetingResult.type,
          agendaItems: meetingResult.agenda.length,
          decisions: meetingResult.decisions.length,
          actionItems: meetingResult.actionItems.length,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, `Meeting simulation completed: ${meetingResult.type}`, 'agents', 'success', `${meetingResult.decisions.length} decisions, ${meetingResult.actionItems.length} actions`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'ceo_voice_report': {
        await updateJobProgress(supabase, job.id, 30)
        const voiceResult = await generateVoiceReport(supabase, job.user_id, job.payload.report_type || 'daily_brief')
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          title: voiceResult.title,
          type: voiceResult.type,
          duration_seconds: voiceResult.duration_seconds,
          sections: voiceResult.sections.length,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, `Voice report completed: ${voiceResult.type}`, 'agents', 'success', `~${voiceResult.duration_seconds}s narration`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'manager_assessment': {
        await updateJobProgress(supabase, job.id, 30)
        const dept = job.payload.department as string
        const managerResult = await runManagerAssessment(supabase, job.user_id, dept as any)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          department: dept,
          summary: managerResult.summary,
          decisionsCount: managerResult.decisions.length,
          successful: managerResult.decisions.filter((d) => d.executed).length,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, `${dept} manager assessment completed`, dept, 'success', `${managerResult.decisions.length} decisions`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'performance_optimization': {
        await updateJobProgress(supabase, job.id, 30)
        const { generatePerfReport } = await import('@/lib/perf/analyzer')
        const perfResult = await generatePerfReport(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          summary: perfResult.summary,
          bottlenecks: perfResult.bottlenecks.length,
          recommendations: perfResult.recommendations.length,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Performance optimization completed', 'agents', 'success', `${perfResult.recommendations.length} recommendations`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'revenue_operation': {
        await updateJobProgress(supabase, job.id, 30)
        const { runFullRevenueCycle } = await import('@/lib/revenue/engine')
        const revResult = await runFullRevenueCycle(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          scored: revResult.scored,
          outreach: revResult.outreach,
          proposals: revResult.proposals,
          meetings: revResult.meetings,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Revenue cycle completed', 'sales', 'success', `${revResult.outreach} outreach, ${revResult.proposals} proposals`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'factory_operation': {
        await updateJobProgress(supabase, job.id, 30)
        const { runFullFactoryCycle } = await import('@/lib/factory/engine')
        const factoryResult = await runFullFactoryCycle(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          hired: factoryResult.hired,
          trained: factoryResult.trained,
          promoted: factoryResult.promoted,
          retired: factoryResult.retired,
          needs: factoryResult.needs.length,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Factory cycle completed', 'agents', 'success', `${factoryResult.hired} hired, ${factoryResult.trained} trained`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'sales_operation': {
        await updateJobProgress(supabase, job.id, 30)
        const { runFullSalesCycle } = await import('@/lib/sales/engine')
        const saleResult = await runFullSalesCycle(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          qualified: saleResult.qualified,
          assigned: saleResult.assigned,
          outreach: saleResult.outreach,
          followups: saleResult.followups,
          proposals: saleResult.proposals,
          meetings: saleResult.meetings,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Sales cycle completed', 'sales', 'success', `${saleResult.outreach} outreach, ${saleResult.followups} followups`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'content_operation': {
        await updateJobProgress(supabase, job.id, 30)
        const { runFullContentCycle } = await import('@/lib/content-marketing/engine')
        const contentResult = await runFullContentCycle(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          ideasGenerated: contentResult.ideasGenerated,
          drafted: contentResult.drafted,
          generated: contentResult.generated,
          scheduled: contentResult.scheduled,
          published: contentResult.published,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Content cycle completed', 'marketing', 'success', `${contentResult.ideasGenerated} ideas, ${contentResult.generated} generated`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'video_operation': {
        await updateJobProgress(supabase, job.id, 30)
        const { runFullVideoCycle } = await import('@/lib/video/engine')
        const videoResult = await runFullVideoCycle(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          ideasGenerated: videoResult.ideasGenerated,
          scripted: videoResult.scripted,
          published: videoResult.published,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Video cycle completed', 'content', 'success', `${videoResult.ideasGenerated} ideas, ${videoResult.published} published`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'website_operation': {
        await updateJobProgress(supabase, job.id, 30)
        const { runFullWebsiteCycle } = await import('@/lib/websites/engine')
        const webResult = await runFullWebsiteCycle(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          requirements: webResult.requirements,
          developments: webResult.developments,
          live: webResult.live,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Website cycle completed', 'development', 'success', `${webResult.requirements} reqs, ${webResult.developments} dev, ${webResult.live} live`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'software_operation': {
        await updateJobProgress(supabase, job.id, 30)
        const { runFullSoftwareCycle } = await import('@/lib/software/engine')
        const swResult = await runFullSoftwareCycle(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          requirements: swResult.requirements,
          architected: swResult.architected,
          deployed: swResult.deployed,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Software cycle completed', 'development', 'success', `${swResult.requirements} reqs, ${swResult.deployed} deployed`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'automation_operation': {
        await updateJobProgress(supabase, job.id, 30)
        const { runFullAutomationCycle } = await import('@/lib/automation/engine')
        const autoResult = await runFullAutomationCycle(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          stages: Object.values(autoResult).reduce((a: number, b: number) => a + b, 0),
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Automation cycle completed', 'operations', 'success', `${Object.keys(autoResult).length} stages advanced`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'outreach_operation': {
        await updateJobProgress(supabase, job.id, 30)
        const { runFullOutreachCycle } = await import('@/lib/outreach/engine')
        const orResult = await runFullOutreachCycle(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          stages: Object.values(orResult).reduce((a: number, b: number) => a + b, 0),
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Outreach cycle completed', 'sales', 'success', `${Object.keys(orResult).length} stages advanced`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'voice_operation': {
        await updateJobProgress(supabase, job.id, 30)
        const { runFullVoiceCycle } = await import('@/lib/voice/engine')
        const vResult = await runFullVoiceCycle(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          stages: Object.values(vResult).reduce((a: number, b: number) => a + b, 0),
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Voice cycle completed', 'sales', 'success', `${Object.keys(vResult).length} stages advanced`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'integration_operation': {
        await updateJobProgress(supabase, job.id, 30)
        const { IntegrationSDK } = await import('@/lib/integrations/sdk')
        const sdk = new IntegrationSDK(supabase, job.user_id)
        const connections = await sdk.getConnections()
        let results: Record<string, any> = {}
        for (const conn of connections.slice(0, 5)) {
          const health = await sdk.getHealthStatus(conn.provider)
          results[conn.provider] = health.connected ? 'ok' : 'error'
        }
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { checked: Object.keys(results).length, results, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Integration health check', 'integrations', 'success', `Checked ${Object.keys(results).length} providers`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'growth_operation': {
        await updateJobProgress(supabase, job.id, 30)
        const { runFullGrowthCycle } = await import('@/lib/growth/engine')
        const gResult = await runFullGrowthCycle(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          contentCreated: gResult.contentCreated,
          leadsGenerated: gResult.leadsGenerated,
          published: gResult.published,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Growth cycle completed', 'growth', 'success', `${gResult.contentCreated} content, ${gResult.leadsGenerated} leads, ${gResult.published} published`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'growth_execution': {
        await updateJobProgress(supabase, job.id, 30)
        const { runFullExecutionCycle } = await import('@/lib/growth/execution')
        const gxResult = await runFullExecutionCycle(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          published: gxResult.published,
          leadsImported: gxResult.leadsImported,
          emailsSent: gxResult.emailsSent,
          meetingsBooked: gxResult.meetingsBooked,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Growth execution completed', 'growth', 'success', `${gxResult.published} published, ${gxResult.leadsImported} leads, ${gxResult.emailsSent} emails`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'production_execution': {
        await updateJobProgress(supabase, job.id, 30)
        const { runDailyGrowthExecution } = await import('@/lib/execution/index')
        const prodResult = await runDailyGrowthExecution(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          published: prodResult.linkedinPublished + prodResult.facebookPublished + prodResult.instagramPublished + prodResult.xPublished + prodResult.youtubePublished,
          emailsSent: prodResult.emailsSent,
          leadsGenerated: prodResult.leadsGenerated,
          meetingsBooked: prodResult.meetingsBooked,
          errors: prodResult.errors.slice(0, 5),
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Production execution completed', 'growth', prodResult.errors.length > 0 ? 'failed' : 'success',
          `Published: ${prodResult.linkedinPublished + prodResult.facebookPublished + prodResult.instagramPublished + prodResult.xPublished + prodResult.youtubePublished}, Emails: ${prodResult.emailsSent}, Leads: ${prodResult.leadsGenerated}`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'reels_full_cycle': {
        await updateJobProgress(supabase, job.id, 20)
        const { runFullReelsCycle } = await import('@/lib/reels')
        const reelResult = await runFullReelsCycle(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          trendsScanned: reelResult.trendsScanned,
          hooksGenerated: reelResult.hooksGenerated,
          scriptsCreated: reelResult.scriptsCreated,
          videosProduced: reelResult.videosProduced,
          videosPublished: reelResult.videosPublished,
          analyticsCollected: reelResult.analyticsCollected,
          errors: reelResult.errors.slice(0, 5),
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Reels factory cycle completed', 'reels', reelResult.errors.length > 0 ? 'failed' : 'success',
          `Produced: ${reelResult.videosProduced}, Published: ${reelResult.videosPublished}, Hooks: ${reelResult.hooksGenerated}`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'reels_trend_scan': {
        await updateJobProgress(supabase, job.id, 30)
        const { TrendScanner } = await import('@/lib/reels')
        const scanner = new TrendScanner(supabase, job.user_id)
        const trendResult = await scanner.runFullScan()
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          trendsFound: trendResult.totalFound,
          topKeywords: trendResult.trends.slice(0, 5).map((t: any) => t.keyword),
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Trend scan completed', 'reels', 'success', `${trendResult.totalFound} trends found`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'reels_competitor_scan': {
        await updateJobProgress(supabase, job.id, 30)
        const { CompetitorIntelligence } = await import('@/lib/reels')
        const ci = new CompetitorIntelligence(supabase, job.user_id)
        const compResult = await ci.runScan()
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          competitorsTracked: compResult.competitorsTracked,
          postsCollected: compResult.postsCollected,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Competitor scan completed', 'reels', 'success', `${compResult.competitorsTracked} competitors`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'reels_generation': {
        await updateJobProgress(supabase, job.id, 30)
        const { ScriptEngine } = await import('@/lib/reels')
        const se = new ScriptEngine(supabase, job.user_id)
        const scripts = await se.generateScripts(job.payload?.topic, 5)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          scriptsCreated: scripts.length,
          topics: scripts.map((s: any) => s.topic),
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Reel generation completed', 'reels', 'success', `${scripts.length} scripts generated`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'reels_publish': {
        await updateJobProgress(supabase, job.id, 30)
        const { PublishingEngine } = await import('@/lib/reels')
        const pe = new PublishingEngine(supabase, job.user_id)
        const pubResults = await pe.publishFromQueue()
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          published: pubResults.filter((r: any) => r.success).length,
          failed: pubResults.filter((r: any) => !r.success).length,
          results: pubResults,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Reel publishing completed', 'reels', 'success', `${pubResults.filter((r: any) => r.success).length} published`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'reels_analytics_sync': {
        await updateJobProgress(supabase, job.id, 30)
        const { AnalyticsEngine } = await import('@/lib/reels')
        const ae = new AnalyticsEngine(supabase, job.user_id)
        const snapshots = await ae.collectDailySnapshots()
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          snapshotsCollected: snapshots.length,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Analytics sync completed', 'reels', 'success', `${snapshots.length} snapshots`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'reels_strategy_update': {
        await updateJobProgress(supabase, job.id, 30)
        const { LearningEngine } = await import('@/lib/reels')
        const le = new LearningEngine(supabase, job.user_id)
        const strategy = await le.runStrategyUpdate()
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          hooksUpdated: strategy.updatedHookScores,
          topicsUpdated: strategy.updatedTopicScores,
          recommendations: strategy.recommendations.slice(0, 5),
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Strategy update completed', 'reels', 'success', `${strategy.recommendations.length} recommendations`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'development_cycle': {
        await updateJobProgress(supabase, job.id, 10)
        const { DevelopmentSystemOrchestrator } = await import('@/lib/development')
        const orch = new DevelopmentSystemOrchestrator(supabase, job.user_id)
        const devResult = await orch.runFullCycle(job.payload.goal || 'Improve Inlight Agency OS', job.payload.context)
        await updateJobProgress(supabase, job.id, 90)
        const taskSummary = devResult.tasks ? `${devResult.tasks.filter((t: any) => t.status === 'completed').length}/${devResult.tasks.length} tasks` : '0 tasks'
        await completeJob(supabase, job.id, {
          planTitle: devResult.plan?.title || 'N/A',
          tasksCompleted: taskSummary,
          buildsSucceeded: devResult.builds?.filter((b: any) => b.success).length || 0,
          lessonsLearned: devResult.lessonsLearned,
          errors: devResult.errors.slice(0, 5),
          status: devResult.status,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Development cycle completed', 'development', devResult.errors.length > 0 ? 'failed' : 'success',
          `${taskSummary}, ${devResult.lessonsLearned} lessons, ${devResult.errors.length} errors`)
        return { processed: true, jobId: job.id, status: devResult.status }
      }

      case 'business_cycle': {
        await updateJobProgress(supabase, job.id, 10)
        const { BusinessGrowthOrchestrator } = await import('@/lib/business')
        const bizOrch = new BusinessGrowthOrchestrator(supabase, job.user_id)
        const bizResult = await bizOrch.runFullCycle(job.payload.industry || 'AI Agency', job.payload.niche)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          opportunities: bizResult.opportunities.length,
          offers: bizResult.offers.length,
          lessons: bizResult.lessonsStored,
          errors: bizResult.errors.slice(0, 5),
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Business cycle completed', 'business', bizResult.errors.length > 0 ? 'failed' : 'success',
          `${bizResult.opportunities.length} opportunities, ${bizResult.offers.length} offers, ${bizResult.lessonsStored} lessons`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'media_buyer_cycle': {
        await updateJobProgress(supabase, job.id, 30)
        const { runFullMediaBuyingCycle } = await import('@/lib/media-buying/engine')
        const mbResult = await runFullMediaBuyingCycle(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          campaignsCreated: mbResult.campaignsCreated,
          creativesGenerated: mbResult.creativesGenerated,
          campaignsLaunched: mbResult.campaignsLaunched,
          roas: mbResult.campaignsOptimized,
          audiencesBuilt: mbResult.audiencesBuilt,
          retargetingCreated: mbResult.retargetingCreated,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Media buyer cycle completed', 'marketing', 'success', `${mbResult.campaignsCreated} campaigns, ${mbResult.retargetingCreated} retargeting`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'media_buyer_campaign_create': {
        await updateJobProgress(supabase, job.id, 30)
        const { generateAdCampaigns } = await import('@/lib/media-buying/engine')
        const created = await generateAdCampaigns(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { campaignsCreated: created, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Campaign creation complete', 'marketing', 'success', `${created} campaigns`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'media_buyer_creative_generate': {
        await updateJobProgress(supabase, job.id, 30)
        const { generateAdCreatives } = await import('@/lib/media-buying/engine')
        const creativesCreated = await generateAdCreatives(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { creativesGenerated: creativesCreated, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Creative generation complete', 'marketing', 'success', `${creativesCreated} creatives`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'media_buyer_optimize': {
        await updateJobProgress(supabase, job.id, 30)
        const { optimizeAdCampaigns } = await import('@/lib/media-buying/engine')
        const optimized = await optimizeAdCampaigns(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { campaignsOptimized: optimized, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Campaign optimization complete', 'marketing', 'success', `${optimized} optimized`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'media_buyer_analyze': {
        await updateJobProgress(supabase, job.id, 30)
        const { analyzeAdPerformance } = await import('@/lib/media-buying/engine')
        const analyzed = await analyzeAdPerformance(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { campaignsAnalyzed: analyzed, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Performance analysis complete', 'marketing', 'success', `${analyzed} campaigns analyzed`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'media_buyer_audience_build': {
        await updateJobProgress(supabase, job.id, 30)
        const { buildAudience } = await import('@/lib/media-buying/engine')
        const audiences = await buildAudience(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { audiencesBuilt: audiences, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Audience building complete', 'marketing', 'success', `${audiences} audiences`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'media_buyer_retargeting': {
        await updateJobProgress(supabase, job.id, 30)
        const { createRetargetingCampaigns } = await import('@/lib/media-buying/engine')
        const retargeting = await createRetargetingCampaigns(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { retargetingCreated: retargeting, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Retargeting campaign creation complete', 'marketing', 'success', `${retargeting} retargeting campaigns`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'software_saas_generate': {
        await updateJobProgress(supabase, job.id, 30)
        const { generateSaasProject } = await import('@/lib/software/saas-generator')
        const saasId = await generateSaasProject(supabase, job.user_id, job.payload.idea || 'AI SaaS application')
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { projectId: saasId, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'SaaS project generated', 'development', 'success', saasId ? `Project: ${saasId}` : 'Failed')
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'software_boilerplate': {
        await updateJobProgress(supabase, job.id, 30)
        const { scaffoldFromBoilerplate } = await import('@/lib/software/boilerplate-generator')
        const files = await scaffoldFromBoilerplate(supabase, job.user_id, job.payload.project_id, job.payload.type || 'nextjs', job.payload.name || 'app')
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { filesGenerated: files, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Boilerplate scaffolded', 'development', 'success', `${files} files`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'software_repo_generate': {
        await updateJobProgress(supabase, job.id, 30)
        const { generateRepository } = await import('@/lib/software/repo-generator')
        const repo = await generateRepository(supabase, job.user_id, job.payload.project_id, job.payload.name, job.payload.type)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { repoName: repo?.name, provider: repo?.provider, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Repository generated', 'development', 'success', `${repo?.provider}/${repo?.name}`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'software_github_actions': {
        await updateJobProgress(supabase, job.id, 30)
        const { generateGithubActions } = await import('@/lib/software/repo-generator')
        const workflows = await generateGithubActions(supabase, job.user_id, job.payload.project_id, job.payload.project_type, job.payload.tech_stack || [])
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { workflowCount: workflows.length, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'GitHub Actions generated', 'development', 'success', `${workflows.length} workflows`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'software_cicd_build': {
        await updateJobProgress(supabase, job.id, 30)
        const { buildCicdPipeline } = await import('@/lib/software/cicd-builder')
        const pipeline = await buildCicdPipeline(supabase, job.user_id, job.payload.project_id, job.payload.project_type, job.payload.deploy_target || 'vercel')
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { stages: pipeline?.stages?.length || 0, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'CI/CD pipeline built', 'development', 'success', `${pipeline?.stages?.length || 0} stages`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'software_docker_build': {
        await updateJobProgress(supabase, job.id, 30)
        const { generateDockerConfig } = await import('@/lib/software/docker-builder')
        const docker = await generateDockerConfig(supabase, job.user_id, job.payload.project_id, job.payload.project_type, job.payload.tech_stack || [])
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { hasDockerfile: !!docker?.dockerfile, hasCompose: !!docker?.dockerCompose, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Docker config generated', 'development', 'success', docker?.dockerfile ? 'Dockerfile created' : 'Failed')
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'software_k8s_generate': {
        await updateJobProgress(supabase, job.id, 30)
        const { generateK8sTemplates } = await import('@/lib/software/k8s-templates')
        const k8s = await generateK8sTemplates(supabase, job.user_id, job.payload.project_id, job.payload.name, job.payload.tech_stack || [])
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { manifestCount: k8s?.manifests?.length || 0, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'K8s templates generated', 'development', 'success', `${k8s?.manifests?.length || 0} manifests`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'software_deploy_vercel': {
        await updateJobProgress(supabase, job.id, 30)
        const { deployToVercel } = await import('@/lib/software/deployment-engine')
        const vercel = await deployToVercel(supabase, job.user_id, job.payload.project_id, job.payload.name, job.payload.project_type)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { url: vercel?.url, status: vercel?.status, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Vercel deploy complete', 'development', 'success', `${vercel?.url || 'Failed'}`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'software_deploy_cloudflare': {
        await updateJobProgress(supabase, job.id, 30)
        const { deployToCloudflare } = await import('@/lib/software/deployment-engine')
        const cf = await deployToCloudflare(supabase, job.user_id, job.payload.project_id, job.payload.name, job.payload.project_type)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { url: cf?.url, status: cf?.status, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Cloudflare deploy complete', 'development', 'success', `${cf?.url || 'Failed'}`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'software_rollback': {
        await updateJobProgress(supabase, job.id, 30)
        const { rollbackDeployment } = await import('@/lib/software/deployment-engine')
        const rb = await rollbackDeployment(supabase, job.user_id, job.payload.project_id, job.payload.target || 'vercel', job.payload.to_version)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { url: rb?.url, version: rb?.version, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Rollback complete', 'development', rb?.status === 'live' ? 'success' : 'failed', `Rolled back to ${rb?.version}`)
        return { processed: true, jobId: job.id, status: rb?.status === 'live' ? 'completed' : 'failed' }
      }

      case 'software_auto_test': {
        await updateJobProgress(supabase, job.id, 30)
        const { generateTestSuite } = await import('@/lib/software/testing-engine')
        const testSuite = await generateTestSuite(supabase, job.user_id, job.payload.project_id, job.payload.name, job.payload.project_type, job.payload.language || 'typescript')
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { testCount: testSuite?.testFiles?.length || 0, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Auto test suite generated', 'development', 'success', `${testSuite?.testFiles?.length || 0} tests`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'software_run_tests': {
        await updateJobProgress(supabase, job.id, 30)
        const { runAllProjectTests } = await import('@/lib/software/testing-engine')
        const testResults = await runAllProjectTests(supabase, job.user_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          projectsTested: testResults.projectsTested,
          totalPassed: testResults.totalPassed,
          totalFailed: testResults.totalFailed,
          avgCoverage: testResults.avgCoverage,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, 'Auto tests completed', 'development', 'success', `${testResults.projectsTested} projects, ${testResults.avgCoverage}% coverage`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'website_wireframe': {
        await updateJobProgress(supabase, job.id, 30)
        const { generateWireframes } = await import('@/lib/websites/wireframe-generator')
        const wf = await generateWireframes(supabase, job.user_id, job.payload.project_id, job.payload.name, job.payload.website_type || 'business')
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { pages: wf?.pages?.length || 0, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Wireframes generated', 'development', 'success', `${wf?.pages?.length || 0} pages`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'website_design_system': {
        await updateJobProgress(supabase, job.id, 30)
        const { generateDesignSystem } = await import('@/lib/websites/design-ai')
        const ds = await generateDesignSystem(supabase, job.user_id, job.payload.project_id, job.payload.name, job.payload.website_type || 'business')
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { hasDesignSystem: !!ds, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Design system generated', 'development', 'success', ds ? 'Created' : 'Failed')
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'website_theme': {
        await updateJobProgress(supabase, job.id, 30)
        const { generateTheme } = await import('@/lib/websites/theme-generator')
        const theme = await generateTheme(supabase, job.user_id, job.payload.project_id, job.payload.name, job.payload.website_type || 'business', job.payload.style)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { hasTheme: !!theme, style: theme?.style, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Theme generated', 'development', 'success', theme?.style || 'Failed')
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'website_landing_page': {
        await updateJobProgress(supabase, job.id, 30)
        const { buildLandingPage } = await import('@/lib/websites/landing-page-builder')
        const lp = await buildLandingPage(supabase, job.user_id, job.payload.project_id, job.payload.name, job.payload.website_type || 'landing_page', job.payload.goal)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { sections: lp?.sections?.length || 0, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Landing page built', 'development', 'success', `${lp?.sections?.length || 0} sections`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'website_seo_score': {
        await updateJobProgress(supabase, job.id, 30)
        const { scoreSeo } = await import('@/lib/websites/seo-engine')
        const seo = await scoreSeo(supabase, job.user_id, job.payload.project_id, job.payload.name, job.payload.website_type || 'website')
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { seoScore: seo?.overall || 0, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'SEO scored', 'development', 'success', `Score: ${seo?.overall || 0}`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'website_lighthouse': {
        await updateJobProgress(supabase, job.id, 30)
        const { runLighthouseAudit } = await import('@/lib/websites/seo-engine')
        const lh = await runLighthouseAudit(supabase, job.user_id, job.payload.project_id, job.payload.name, job.payload.url)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { perf: lh?.performance || 0, seo: lh?.seo || 0, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Lighthouse audit complete', 'development', 'success', `Perf: ${lh?.performance || 0}, SEO: ${lh?.seo || 0}`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'website_auto_deploy': {
        await updateJobProgress(supabase, job.id, 30)
        const { configureAutoDeploy } = await import('@/lib/websites/auto-deploy')
        const config = await configureAutoDeploy(supabase, job.user_id, job.payload.project_id, job.payload.name, job.payload.website_type || 'business', job.payload.platform || 'vercel')
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { platform: config?.platform, domains: config?.domains?.length || 0, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Auto-deploy configured', 'development', 'success', `${config?.platform || 'Failed'}`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      case 'website_deploy_live': {
        await updateJobProgress(supabase, job.id, 30)
        const { deployToLive } = await import('@/lib/websites/auto-deploy')
        const result = await deployToLive(supabase, job.user_id, job.payload.project_id)
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, { live: result.live, url: result.url, _started_at: new Date(startedAt).toISOString() })
        await logQueueExecution(supabase, job.user_id, job.id, 'Website deployed to live', 'development', result.live ? 'success' : 'failed', result.url || 'Failed')
        return { processed: true, jobId: job.id, status: result.live ? 'completed' : 'failed' }
      }

      case 'video_render': {
        await updateJobProgress(supabase, job.id, 30)
        const renderResult = await processRenderJob(supabase, job.user_id, job.payload.job_type, job.payload.provider, job.payload.params || {})
        await updateJobProgress(supabase, job.id, 90)
        await completeJob(supabase, job.id, {
          output: renderResult,
          jobType: job.payload.job_type,
          provider: job.payload.provider,
          _started_at: new Date(startedAt).toISOString(),
        })
        await logQueueExecution(supabase, job.user_id, job.id, `${job.payload.job_type} render complete`, 'content', 'success', `${job.payload.provider} generated ${job.payload.job_type}`)
        return { processed: true, jobId: job.id, status: 'completed' }
      }

      default:
        await failJob(supabase, job.id, `Unknown job type: ${job.job_type}`, false)
        await logQueueExecution(supabase, job.user_id, job.id, 'Unknown job type', 'automations', 'failed', job.job_type)
        return { processed: true, jobId: job.id, status: 'failed', error: `Unknown job type: ${job.job_type}` }
    }
  } catch (err: any) {
    await failJob(supabase, job.id, err.message || 'Unknown error')
    await logQueueExecution(supabase, job.user_id, job.id, 'Job failed', 'automations', 'failed', err.message || 'Unknown error')
    return { processed: true, jobId: job.id, status: 'failed', error: err.message }
  }
}
