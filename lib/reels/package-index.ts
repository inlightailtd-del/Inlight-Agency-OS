import type { SupabaseClient } from '@supabase/supabase-js'
import { ReelPackageGenerator } from './package-generator'
import { type ReelPackageResult } from './package-types'

export async function runReelPackageFactory(
  supabase: SupabaseClient,
  userId: string,
  count = 3
): Promise<ReelPackageResult> {
  const startTime = Date.now()

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: '[ReelPackage] Factory started', module: 'reels',
    status: 'running', message: `Generating ${count} complete reel packages`,
  }])

  const generator = new ReelPackageGenerator(supabase, userId)
  const result = await generator.generateDaily(count)

  const durationMs = Date.now() - startTime

  await supabase.from('execution_logs').insert([{
    user_id: userId, command_id: null,
    action: '[ReelPackage] Factory completed', module: 'reels',
    status: result.errors.length > 0 ? 'failed' : 'success',
    message: `${result.packagesCreated} packages (${result.totalDuration}) in ${(durationMs / 1000).toFixed(1)}s | Errors: ${result.errors.length}`,
  }])

  return result
}
