import type { SupabaseClient } from '@supabase/supabase-js'
import { dequeueNextJob, completeJob, failJob, updateJobProgress } from './queue'
import { executeAgentTask } from '@/lib/ai/execution'
import { runWorkflow } from '@/lib/ai/workflow'
import { generateContent } from '@/lib/ai/content-engine'
import { analyzeLead } from '@/lib/ai/lead-analyzer'
import { runCeoAssessment } from '@/lib/ceo/ceo'
import { runManagerAssessment, listDepartments } from '@/lib/ceo/manager'

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
