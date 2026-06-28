import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export interface StoryboardScene {
  scene: number
  duration_seconds: number
  visual_description: string
  camera_angle: string
  dialogue: string
  background_music: string
  visual_style: string
  transition: string
}

export interface Storyboard {
  title: string
  total_duration_seconds: number
  scenes: StoryboardScene[]
  visual_theme: string
  color_palette: string[]
}

export async function generateStoryboard(
  supabase: SupabaseClient,
  userId: string,
  script: string,
  title: string,
  content_type: 'reel' | 'short' | 'long' = 'short'
): Promise<Storyboard> {
  const systemPrompt = `You are a Video Director creating a detailed storyboard. Break down the script into visual scenes.

Return JSON only:
{
  "visual_theme": "overall visual style description",
  "color_palette": ["color1", "color2", "color3"],
  "scenes": [
    {
      "scene": 1,
      "duration_seconds": 5,
      "visual_description": "detailed visual description of what happens on screen",
      "camera_angle": "wide|medium|close_up|aerial|tracking|pan|dolly",
      "dialogue": "what is said during this scene",
      "background_music": "mood/style of music",
      "visual_style": "cinematic|documentary|commercial|vlog|animated|motion_graphics",
      "transition": "cut|fade|dissolve|wipe|zoom"
    }
  ]
}

For ${content_type}-form content:
- Reel: 3-8 scenes, 2-5 seconds each
- Short: 5-12 scenes, 3-8 seconds each
- Long: 8-20 scenes, 5-30 seconds each`

  const result = await executeAgentTask(supabase, userId, null,
    `Create a storyboard for "${title}" (${content_type}). Script:\n\n${script}`,
    { systemPrompt }
  )

  let parsed: any = { visual_theme: '', color_palette: [], scenes: [] }
  try { parsed = JSON.parse(result.response || '{}') } catch { parsed.scenes = [] }

  const scenes: StoryboardScene[] = (parsed.scenes || []).map((s: any) => ({
    scene: s.scene || 0,
    duration_seconds: s.duration_seconds || 3,
    visual_description: s.visual_description || '',
    camera_angle: s.camera_angle || 'medium',
    dialogue: s.dialogue || '',
    background_music: s.background_music || 'ambient',
    visual_style: s.visual_style || 'cinematic',
    transition: s.transition || 'cut',
  }))

  const totalDuration = scenes.reduce((sum: number, s: StoryboardScene) => sum + s.duration_seconds, 0)

  return {
    title,
    total_duration_seconds: totalDuration,
    scenes,
    visual_theme: parsed.visual_theme || 'Modern professional',
    color_palette: parsed.color_palette || ['#1a1a2e', '#16213e', '#0f3460'],
  }
}

export async function storeStoryboard(
  supabase: SupabaseClient,
  userId: string,
  videoId: string,
  storyboard: Storyboard
) {
  await storeMemory(supabase, userId, {
    category: 'video_storyboard',
    tags: ['storyboard', videoId, storyboard.title.toLowerCase().replace(/\s+/g, '_')],
    content: {
      videoId,
      ...storyboard,
      generatedAt: new Date().toISOString(),
    },
  })
}
