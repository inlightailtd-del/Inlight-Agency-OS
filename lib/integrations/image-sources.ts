/**
 * Image Source Integrations — Unsplash + Pexels
 *
 * Real API calls for stock photography used by the content factory.
 * Both offer generous free tiers with API keys.
 */

export interface StockImage {
  id: string
  url: string          // Full-size image URL
  thumb: string        // Small thumbnail
  alt: string          // Description for alt text
  photographer: string
  photographerUrl: string
  source: 'unsplash' | 'pexels'
}

// ─── Unsplash ──────────────────────────────────────────────

const UNSPLASH_API = 'https://api.unsplash.com'

/**
 * Search Unsplash for stock photos matching a query.
 * Free tier: 50 requests/hour. Requires API key from unsplash.com/developers.
 */
export async function searchUnsplash(
  query: string,
  count = 5
): Promise<StockImage[]> {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY
  if (!apiKey) {
    console.warn('[ImageSources] UNSPLASH_ACCESS_KEY not set — returning empty')
    return []
  }

  try {
    const res = await fetch(
      `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          Authorization: `Client-ID ${apiKey}`,
          'Accept-Version': 'v1',
        },
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!res.ok) {
      console.warn(`[ImageSources] Unsplash error: ${res.status}`)
      return []
    }

    const data = await res.json()
    return (data.results || []).map((r: any) => ({
      id: `unsplash_${r.id}`,
      url: r.urls?.regular || '',
      thumb: r.urls?.thumb || '',
      alt: r.alt_description || 'Stock photo',
      photographer: r.user?.name || 'Unknown',
      photographerUrl: r.user?.links?.html || '',
      source: 'unsplash' as const,
    }))
  } catch (err) {
    console.warn('[ImageSources] Unsplash fetch failed:', err)
    return []
  }
}

/**
 * Get a curated set of photos for a content topic.
 * Maps content categories to search queries for relevant imagery.
 */
export async function getUnsplashPhotosForTopic(
  topic: string,
  category: string,
  count = 3
): Promise<StockImage[]> {
  // Map categories to better search terms
  const searchTerms: Record<string, string> = {
    ai: 'artificial intelligence technology',
    automation: 'automation robot workflow',
    saas: 'software dashboard saas',
    marketing: 'digital marketing social media',
    agency: 'agency office teamwork',
    startup: 'startup office innovation',
    business: 'business office professional',
    technology: 'technology computer coding',
    general: `${topic} professional`,
  }

  const query = searchTerms[category] || `${topic} professional`
  const results = await searchUnsplash(query, count)

  // Fallback: if no results, try the raw topic
  if (results.length === 0) {
    return searchUnsplash(topic, count)
  }

  return results
}

// ─── Pexels ────────────────────────────────────────────────

const PEXELS_API = 'https://api.pexels.com/v1'

/**
 * Search Pexels for stock photos/videos matching a query.
 * Free tier: 200 requests/hour + 16,000 requests/month.
 * Requires API key from pexels.com/api.
 */
export async function searchPexels(
  query: string,
  count = 5
): Promise<StockImage[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    console.warn('[ImageSources] PEXELS_API_KEY not set — returning empty')
    return []
  }

  try {
    const res = await fetch(
      `${PEXELS_API}/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          Authorization: apiKey,
        },
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!res.ok) {
      console.warn(`[ImageSources] Pexels error: ${res.status}`)
      return []
    }

    const data = await res.json()
    return (data.photos || []).map((p: any) => ({
      id: `pexels_${p.id}`,
      url: p.src?.large || '',
      thumb: p.src?.tiny || '',
      alt: p.alt || 'Stock photo',
      photographer: p.photographer || 'Unknown',
      photographerUrl: p.photographer_url || '',
      source: 'pexels' as const,
    }))
  } catch (err) {
    console.warn('[ImageSources] Pexels fetch failed:', err)
    return []
  }
}

/**
 * Get Pexels photos for a content topic.
 */
export async function getPexelsPhotosForTopic(
  topic: string,
  category: string,
  count = 3
): Promise<StockImage[]> {
  const searchTerms: Record<string, string> = {
    ai: 'artificial intelligence technology',
    automation: 'automation robot workflow',
    saas: 'software dashboard analytics',
    marketing: 'digital marketing social media',
    agency: 'agency office teamwork',
    startup: 'startup office innovation',
    business: 'corporate business meeting',
    technology: 'technology coding programming',
    general: `${topic} professional photography`,
  }

  const query = searchTerms[category] || `${topic} photography`
  const results = await searchPexels(query, count)

  if (results.length === 0) {
    return searchPexels(topic, count)
  }

  return results
}

/**
 * Fetch images from both Unsplash and Pexels for a topic.
 * Returns merged results with deduplication by URL.
 */
export async function getImagesForTopic(
  topic: string,
  category: string,
  count = 5
): Promise<StockImage[]> {
  const [unsplash, pexels] = await Promise.all([
    getUnsplashPhotosForTopic(topic, category, Math.ceil(count / 2)),
    getPexelsPhotosForTopic(topic, category, Math.ceil(count / 2)),
  ])

  const seen = new Set<string>()
  const merged: StockImage[] = []

  for (const img of [...unsplash, ...pexels]) {
    if (!seen.has(img.url)) {
      seen.add(img.url)
      merged.push(img)
    }
  }

  return merged.slice(0, count)
}
