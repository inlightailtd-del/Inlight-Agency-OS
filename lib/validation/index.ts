import type { SupabaseClient } from '@supabase/supabase-js'
import type { ValidationResult, AuditReport } from './types'
import { GmailApiValidator, GmailCredentialsValidator } from './gmail-validator'
import { LinkedInApiValidator, LinkedInCredentialsValidator } from './linkedin-validator'
import { FacebookApiValidator, FacebookCredentialsValidator } from './facebook-validator'
import { PublishedContentValidator, ContentFactoryValidator } from './content-validator'
import { GrowthCalendarValidator, GrowthEngineValidator } from './growth-validator'
import { VoiceValidator } from './voice-validator'
import { AIProvidersValidator, ProductionBuildValidator, DatabaseConnectionValidator } from './ai-validator'

export async function runFullProductionAudit(
  supabase: SupabaseClient,
  userId: string
): Promise<AuditReport> {
  const start = Date.now()

  // Create the run record
  const { data: run, error: runError } = await supabase
    .from('validation_runs')
    .insert([{ user_id: userId, status: 'running', total_checks: 0 }])
    .select('id')
    .single()

  if (runError || !run) {
    throw new Error(`Failed to create validation run: ${runError?.message}`)
  }

  const runId = run.id

  // Build all validators
  const validators = [
    new GmailApiValidator(supabase, userId),
    new GmailCredentialsValidator(supabase, userId),
    new LinkedInApiValidator(supabase, userId),
    new LinkedInCredentialsValidator(supabase, userId),
    new FacebookApiValidator(supabase, userId),
    new FacebookCredentialsValidator(supabase, userId),
    new PublishedContentValidator(supabase, userId),
    new ContentFactoryValidator(supabase, userId),
    new GrowthCalendarValidator(supabase, userId),
    new GrowthEngineValidator(supabase, userId),
    new VoiceValidator(supabase, userId),
    new AIProvidersValidator(supabase, userId),
    new ProductionBuildValidator(supabase, userId),
    new DatabaseConnectionValidator(supabase, userId),
  ]

  const results: ValidationResult[] = []
  let passed = 0, warnings = 0, failed = 0

  // Run each validator sequentially
  for (const validator of validators) {
    try {
      const result = await validator.validate()
      results.push(result)
      if (result.status === 'working') passed++
      else if (result.status === 'warning') warnings++
      else if (result.status === 'broken') failed++
    } catch (e: any) {
      const errorResult: ValidationResult = {
        slug: validator.slug,
        name: validator.name,
        category: validator.category,
        status: 'broken',
        message: `Validator threw exception: ${e.message}`,
        details: { error: e.message },
        durationMs: 0,
      }
      results.push(errorResult)
      failed++
    }
  }

  // Store all results in DB
  const resultRows = results.map(r => ({
    run_id: runId,
    user_id: userId,
    slug: r.slug,
    name: r.name,
    category: r.category,
    status: r.status,
    status_code: r.statusCode || null,
    message: r.message,
    details: r.details,
    duration_ms: r.durationMs,
  }))

  const { error: insertError } = await supabase
    .from('validation_results')
    .insert(resultRows)

  if (insertError) {
    console.error('Failed to store validation results:', insertError.message)
  }

  // Update the run record
  const completedAt = new Date().toISOString()
  const durationMs = Date.now() - start

  await supabase
    .from('validation_runs')
    .update({
      status: 'completed',
      total_checks: results.length,
      passed_checks: passed,
      warning_checks: warnings,
      failed_checks: failed,
      duration_ms: durationMs,
      completed_at: completedAt,
    })
    .eq('id', runId)

  return {
    runId,
    status: 'completed',
    totalChecks: results.length,
    passedChecks: passed,
    warningChecks: warnings,
    failedChecks: failed,
    durationMs,
    results,
  }
}
