import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export interface SubtitleTrack {
  language: string
  segments: SubtitleSegment[]
  format: 'srt' | 'vtt' | 'ass'
}

export interface SubtitleSegment {
  index: number
  start: number
  end: number
  text: string
}

export async function generateSubtitlesFromScript(
  supabase: SupabaseClient,
  userId: string,
  script: string,
  language = 'en',
  format: 'srt' | 'vtt' = 'srt'
): Promise<SubtitleTrack> {
  const systemPrompt = `You are a subtitle generation engine. Given a video script, generate timed subtitle segments.

Return JSON only:
{
  "segments": [
    {
      "index": 1,
      "start": 0.0,
      "end": 3.5,
      "text": "spoken text for this segment"
    }
  ]
}

Rules:
- Split at natural pauses (sentences, phrases)
- Each segment should be 1-8 seconds
- Keep each segment to max 42 characters per line, max 2 lines
- Total segments should cover the full script`

  const result = await executeAgentTask(supabase, userId, null,
    `Generate subtitle segments for this script (${language}, ${format}):\n\n${script}`,
    { systemPrompt }
  )

  let segments: SubtitleSegment[] = []
  try {
    const parsed = JSON.parse(result.response || '{}')
    segments = (parsed.segments || []).map((s: any, i: number) => ({
      index: s.index || i + 1,
      start: s.start || 0,
      end: s.end || 3,
      text: s.text || '',
    }))
  } catch {
    segments = [{
      index: 1, start: 0, end: 3,
      text: script.length > 80 ? script.slice(0, 80) + '...' : script,
    }]
  }

  return { language, segments, format }
}

export function formatSubtitles(track: SubtitleTrack): string {
  switch (track.format) {
    case 'srt':
      return track.segments.map((seg) =>
        `${seg.index}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${seg.text}\n`
      ).join('\n')

    case 'vtt':
      return `WEBVTT\n\n${track.segments.map((seg) =>
        `${formatSrtTime(seg.start).replace(',', '.')} --> ${formatSrtTime(seg.end).replace(',', '.')}\n${seg.text}\n`
      ).join('\n')}`

    default:
      return track.segments.map((s) => `[${s.start.toFixed(1)}s-${s.end.toFixed(1)}s] ${s.text}`).join('\n')
  }
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(Math.floor(s)).padStart(2, '0')},${String(Math.round((s % 1) * 1000)).padStart(3, '0')}`
}

export async function translateSubtitles(
  supabase: SupabaseClient,
  userId: string,
  track: SubtitleTrack,
  targetLanguage: string
): Promise<SubtitleTrack> {
  const textToTranslate = track.segments.map((s) => s.text).join('\n---\n')

  const systemPrompt = `Translate the following subtitle segments to ${targetLanguage}. Keep the same segment structure.

Return JSON only:
{
  "segments": [
    {"index": 1, "text": "translated text"}
  ]
}`

  const result = await executeAgentTask(supabase, userId, null, textToTranslate, { systemPrompt })

  let translatedTexts: string[] = []
  try {
    const parsed = JSON.parse(result.response || '{}')
    translatedTexts = (parsed.segments || []).map((s: any) => s.text || '')
  } catch {
    translatedTexts = track.segments.map(() => '[translation error]')
  }

  const newSegments = track.segments.map((seg, i) => ({
    ...seg,
    text: translatedTexts[i] || seg.text,
  }))

  return { language: targetLanguage, segments: newSegments, format: track.format }
}

export async function storeSubtitles(
  supabase: SupabaseClient,
  userId: string,
  videoId: string,
  subtitle: SubtitleTrack
) {
  await storeMemory(supabase, userId, {
    category: 'video_subtitles',
    tags: ['subtitles', videoId, subtitle.language, subtitle.format],
    content: {
      videoId,
      language: subtitle.language,
      format: subtitle.format,
      segments: subtitle.segments,
      subtitleContent: formatSubtitles(subtitle),
      generatedAt: new Date().toISOString(),
    },
  })
}
