import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateWebsiteCode } from '@/lib/websites/code-generator'

const USER_ID = '66009792-1d0e-48ca-9a22-7e8f9ab3c7f8'
const PROJECT_ID = 'e7118183-3424-40a5-a73f-d551249fb5f1'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    await supabase.from('website_projects').update({
      status: 'design', updated_at: new Date().toISOString(),
    }).eq('id', PROJECT_ID)

    const startTime = Date.now()
    const generated = await generateWebsiteCode(supabase, USER_ID, PROJECT_ID)
    const elapsed = Date.now() - startTime

    const { data: final } = await supabase
      .from('website_projects')
      .select('id, status, generated_code, generated_at')
      .eq('id', PROJECT_ID)
      .single()

    const { data: files } = await supabase
      .from('website_project_files')
      .select('path, type, size')
      .eq('project_id', PROJECT_ID)

    return NextResponse.json({
      success: !!generated,
      projectId: PROJECT_ID,
      elapsedMs: elapsed,
      fileCount: files?.length || 0,
      generatedAt: final?.generated_at || null,
      status: final?.status || 'unknown',
      files: files || [],
      generated_summary: generated ? {
        pages: generated.pages, totalSize: generated.totalSize, fileCount: generated.files.length,
      } : null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 })
  }
}
