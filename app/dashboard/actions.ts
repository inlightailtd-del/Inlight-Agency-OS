'use server'

import { createClient } from '@/lib/supabase/server'
import { runDailyGrowthExecution } from '@/lib/execution'
import { revalidatePath } from 'next/cache'

export async function runDailyGrowthAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')

  const result = await runDailyGrowthExecution(supabase, user.id)

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/growth')

  return {
    contentGenerated: result.contentGenerated,
    linkedinPublished: result.linkedinPublished,
    emailsSent: result.emailsSent,
    leadsGenerated: result.leadsGenerated,
    errors: result.errors,
    phaseStatus: result.phaseStatus,
    reportSummary: result.reportSummary,
  }
}
