/**
 * News API Integration — Market Intelligence + Content Research
 *
 * Provides trending news data for content ideation, competitive intelligence,
 * and market research. Free tier: 100 requests/day (newsapi.org).
 */

export interface NewsArticle {
  title: string
  description: string
  url: string
  source: string
  publishedAt: string
  category: string
  relevanceScore: number
}

// ─── NewsAPI.org ───────────────────────────────────────────

const NEWSAPI_URL = 'https://newsapi.org/v2'

/**
 * Fetch top headlines by category.
 * Free tier: 100 requests/day, 7-day history.
 * Requires API key from newsapi.org.
 */
export async function fetchNewsHeadlines(
  category: string = 'technology',
  country: string = 'us',
  pageSize: number = 10
): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWSAPI_API_KEY
  if (!apiKey) {
    console.warn('[NewsSources] NEWSAPI_API_KEY not set — returning empty')
    return []
  }

  try {
    const res = await fetch(
      `${NEWSAPI_URL}/top-headlines?country=${country}&category=${category}&pageSize=${pageSize}`,
      {
        headers: { Authorization: apiKey },
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!res.ok) {
      console.warn(`[NewsSources] NewsAPI error: ${res.status}`)
      return []
    }

    const data = await res.json()
    return (data.articles || []).map((a: any) => ({
      title: a.title || '',
      description: a.description || '',
      url: a.url || '',
      source: a.source?.name || 'News',
      publishedAt: a.publishedAt || new Date().toISOString(),
      category: mapNewsCategory(category),
      relevanceScore: 50,
    }))
  } catch (err) {
    console.warn('[NewsSources] NewsAPI fetch failed:', err)
    return []
  }
}

/**
 * Search news articles by keyword.
 */
export async function searchNews(
  query: string,
  pageSize: number = 10
): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWSAPI_API_KEY
  if (!apiKey) return []

  try {
    const res = await fetch(
      `${NEWSAPI_URL}/everything?q=${encodeURIComponent(query)}&pageSize=${pageSize}&sortBy=publishedAt`,
      {
        headers: { Authorization: apiKey },
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!res.ok) {
      console.warn(`[NewsSources] NewsAPI search error: ${res.status}`)
      return []
    }

    const data = await res.json()
    return (data.articles || []).map((a: any) => ({
      title: a.title || '',
      description: a.description || '',
      url: a.url || '',
      source: a.source?.name || 'News',
      publishedAt: a.publishedAt || new Date().toISOString(),
      category: inferArticleCategory(a.title || '', a.description || ''),
      relevanceScore: 50,
    }))
  } catch (err) {
    console.warn('[NewsSources] NewsAPI search failed:', err)
    return []
  }
}

/**
 * Fetch multi-category news for content research.
 * Returns a flat list of articles across all relevant categories.
 */
export async function fetchMultiCategoryNews(
  categories: string[] = ['technology', 'business', 'science'],
  pageSize: number = 5
): Promise<NewsArticle[]> {
  const results = await Promise.all(
    categories.map((cat) => fetchNewsHeadlines(cat, 'us', pageSize))
  )

  const allArticles: NewsArticle[] = []
  const seen = new Set<string>()

  for (const articles of results) {
    for (const article of articles) {
      // Deduplicate by title
      const key = article.title.toLowerCase().slice(0, 60)
      if (!seen.has(key)) {
        seen.add(key)
        allArticles.push(article)
      }
    }
  }

  return allArticles.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}

/**
 * Get news relevant for content ideation.
 * Returns articles with relevance scoring for agency/business topics.
 */
export async function getNewsForContentResearch(count: number = 10): Promise<NewsArticle[]> {
  const articles = await fetchMultiCategoryNews(
    ['technology', 'business', 'science'],
    Math.ceil(count / 3) + 2
  )

  // Score relevance based on keyword matching
  const agencyKeywords = [
    'ai', 'artificial intelligence', 'automation', 'agency', 'digital',
    'saas', 'startup', 'marketing', 'social media', 'content',
    'llm', 'gpt', 'machine learning', 'data', 'analytics',
    'growth', 'revenue', 'business', 'innovation', 'tech',
  ]

  return articles.slice(0, count).map((article) => {
    const text = `${article.title} ${article.description}`.toLowerCase()
    const matches = agencyKeywords.filter((kw) => text.includes(kw)).length
    return {
      ...article,
      relevanceScore: Math.min(95, 30 + matches * 12),
    }
  }).sort((a, b) => b.relevanceScore - a.relevanceScore)
}

// ─── Helpers ───────────────────────────────────────────────

function mapNewsCategory(category: string): string {
  const map: Record<string, string> = {
    business: 'business',
    technology: 'technology',
    science: 'technology',
    health: 'general',
    sports: 'general',
    entertainment: 'general',
    general: 'general',
  }
  return map[category] || 'general'
}

function inferArticleCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase()
  if (/\b(ai|artificial intelligence|machine learning|llm|neural)\b/.test(text)) return 'ai'
  if (/\b(automation|workflow|robotic)\b/.test(text)) return 'automation'
  if (/\b(saas|software|cloud|platform|api)\b/.test(text)) return 'saas'
  if (/\b(marketing|seo|content|social|brand|advert)\b/.test(text)) return 'marketing'
  if (/\b(startup|venture|funding|investor)\b/.test(text)) return 'startup'
  if (/\b(business|growth|revenue|profit|market)\b/.test(text)) return 'business'
  if (/\b(tech|digital|innovate|transform)\b/.test(text)) return 'technology'
  return 'general'
}
