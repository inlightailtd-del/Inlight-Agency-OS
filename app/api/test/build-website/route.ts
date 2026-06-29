import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runFullWebsiteCycle } from '@/lib/websites/engine'
import { deployToLive } from '@/lib/websites/auto-deploy'

const USER_ID = '66009792-1d0e-48ca-9a22-7e8f9ab3c7f8'

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

    const existing = await supabase
      .from('website_projects')
      .select('id')
      .eq('user_id', USER_ID)
      .eq('name', 'Inlight AI Agency')
      .limit(1)

    let projectId: string

    if (existing.data && existing.data.length > 0) {
      projectId = existing.data[0].id
      const cycleResult = await runFullWebsiteCycle(supabase, USER_ID)
      const deployResult = await deployToLive(supabase, USER_ID, projectId)

      const { data: final } = await supabase
        .from('website_projects')
        .select('*')
        .eq('id', projectId)
        .single()

      const { data: files } = await supabase
        .from('website_project_files')
        .select('path, type, size')
        .eq('project_id', projectId)

      return NextResponse.json({
        success: true, projectId,
        liveUrl: final?.live_url || null,
        status: final?.status || 'unknown',
        fileCount: files?.length || 0,
        generatedAt: final?.generated_at || null,
        cycleResult,
        deployResult,
      })
    }

    const newProject = await supabase.from('website_projects').insert([{
      user_id: USER_ID,
      name: 'Inlight AI Agency',
      description: 'AI-powered digital agency offering marketing, development, and automation services. We help businesses grow with cutting-edge AI solutions.',
      website_type: 'agency',
      status: 'idea',
      pages: 5,
    }]).select().single()

    if (!newProject.data) {
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
    }

    projectId = newProject.data.id
    const cycleResult = await runFullWebsiteCycle(supabase, USER_ID)
    const deployResult = await deployToLive(supabase, USER_ID, projectId)

    const { data: final } = await supabase
      .from('website_projects')
      .select('*')
      .eq('id', projectId)
      .single()

    const { data: files } = await supabase
      .from('website_project_files')
      .select('path, type, size')
      .eq('project_id', projectId)

    return NextResponse.json({
      success: true, projectId,
      liveUrl: final?.live_url || null,
      status: final?.status || 'unknown',
      fileCount: files?.length || 0,
      generatedAt: final?.generated_at || null,
      cycleResult,
      deployResult,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 })
  }
}
