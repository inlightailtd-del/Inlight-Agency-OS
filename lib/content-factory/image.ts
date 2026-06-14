import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { renderTemplate, type TemplateId, type TemplateInput } from './templates'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export interface GeneratedImage {
  buffer: Buffer
  fileName: string
  url: string
  width: number
  height: number
  sizeBytes: number
}

/**
 * Generate a branded PNG image from a template.
 * The SVG is rendered server-side via sharp (no canvas/browser needed).
 */
export async function generateImage(templateId: TemplateId, input: TemplateInput): Promise<GeneratedImage> {
  const svg = renderTemplate(templateId, input)
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer()
  const fileName = `${templateId}_${Date.now()}.png`
  return { buffer, fileName, width: 1200, height: 630, sizeBytes: buffer.length, url: '' }
}

/**
 * Upload a generated image to Supabase Storage (public bucket 'content-media').
 */
export async function uploadImage(buffer: Buffer, fileName: string): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const { error } = await supabase.storage.from('content-media').upload(fileName, buffer, {
    contentType: 'image/png',
    cacheControl: '86400',
    upsert: true,
  })
  if (error && !error.message.includes('already exists')) throw new Error(`Storage upload: ${error.message}`)
  const { data: pub } = supabase.storage.from('content-media').getPublicUrl(fileName)
  return pub.publicUrl
}

/**
 * Generate + upload in one call.
 */
export async function generateAndUpload(templateId: TemplateId, input: TemplateInput): Promise<GeneratedImage> {
  const img = await generateImage(templateId, input)
  const url = await uploadImage(img.buffer, img.fileName)
  img.url = url
  return img
}
