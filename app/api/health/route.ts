import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()
  const checks: Record<string, any> = {}

  // Database connectivity
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('execution_logs').select('id', { count: 'exact', head: true }).limit(1)
    checks.database = { ok: !error, error: error?.message || null }
  } catch (e: any) {
    checks.database = { ok: false, error: e.message }
  }

  // Environment check
  checks.environment = {
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    appUrl: !!process.env.NEXT_PUBLIC_APP_URL,
    cronSecret: !!process.env.CRON_SECRET,
  }

  // Connected APIs
  checks.apis = {
    unsplash: !!process.env.UNSPLASH_ACCESS_KEY,
    pexels: !!process.env.PEXELS_API_KEY,
    newsapi: !!process.env.NEWSAPI_API_KEY,
    linkedin: !!process.env.LINKEDIN_CLIENT_ID,
    google: !!process.env.GOOGLE_CLIENT_ID,
    facebook: !!process.env.FACEBOOK_CLIENT_ID,
  }

  checks.durationMs = Date.now() - start
  const allOk = Object.values(checks).every((c: any) => c.ok !== false)

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    checks,
  })
}
