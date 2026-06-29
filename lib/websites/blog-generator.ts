import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import type { DesignSystem } from './design-ai'
import type { ThemeConfig } from './theme-generator'

export interface BlogPost {
  slug: string
  title: string
  description: string
  content: string
  author: string
  date: string
  category: string
  tags: string[]
  readTime: string
  image?: string
}

export interface BlogData {
  posts: BlogPost[]
  listingHtml: string
  postPages: { path: string; content: string }[]
}

export async function generateBlogForSite(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  siteName: string,
  siteType: string,
  design: DesignSystem | null,
  theme: ThemeConfig | null,
  description: string
): Promise<BlogData | null> {
  const posts = await generateBlogPosts(supabase, userId, siteName, siteType, description)
  if (!posts || posts.length === 0) return null

  const primary = theme?.colors?.light?.primary || design?.colors?.primary || '#3b82f6'
  const bg = theme?.colors?.light?.background || design?.colors?.background || '#ffffff'
  const text = theme?.colors?.light?.text || design?.colors?.text || '#0f172a'
  const headingFont = theme?.fonts?.heading || design?.typography?.headings?.font || 'Inter'
  const bodyFont = theme?.fonts?.body || design?.typography?.body?.font || 'Inter'

  const postPages: { path: string; content: string }[] = []
  const recentPosts = posts.slice(0, 6)

  for (const post of posts) {
    const html = generateBlogPostPage(post, posts, siteName, primary, bg, text, headingFont, bodyFont)
    postPages.push({ path: `/blog/${post.slug}.html`, content: html })
  }

  const listingHtml = generateBlogListing(recentPosts, siteName, primary, bg, text, headingFont, bodyFont, description)

  return { posts, listingHtml, postPages }
}

async function generateBlogPosts(
  supabase: SupabaseClient,
  userId: string,
  siteName: string,
  siteType: string,
  description: string
): Promise<BlogPost[] | null> {
  const systemPrompt = `You are a Content Strategist and Senior Writer. Generate 4 high-quality blog posts for a website. Return a JSON array of posts.

Each post must have:
- slug: URL-friendly version of title (e.g. "why-ai-marketing")
- title: Compelling, SEO-optimized headline
- description: 2-3 sentence meta description
- content: 800-1200 words of rich HTML content with <h2>, <h3>, <p>, <ul>, <blockquote>, <strong> tags — formatted as HTML string (not markdown)
- author: "Inlight AI"
- date: current date as YYYY-MM-DD
- category: one of ["Technology", "Marketing", "Business", "AI", "Strategy", "Growth", "Digital"]
- tags: 3-5 relevant tags
- readTime: estimated read time like "5 min read"

The posts should be relevant to a ${siteType} website: "${siteName}" — ${description || 'A professional business website'}.
Include a mix of educational, promotional, and industry-trend content.
Make titles click-worthy and content genuinely useful. No fluff.`

  const result = await executeAgentTask(supabase, userId, null,
    `Generate 4 blog posts for ${siteName} (${siteType}). ${description}`,
    { systemPrompt }
  )

  let posts: BlogPost[] = []
  try {
    const parsed = JSON.parse(result.response || '[]')
    posts = Array.isArray(parsed) ? parsed : []
  } catch {
    return null
  }

  if (posts.length === 0) return null
  return posts.map((p, i) => ({
    ...p,
    slug: p.slug || `post-${i + 1}`,
    date: p.date || new Date().toISOString().split('T')[0],
    author: p.author || 'Inlight AI',
    readTime: p.readTime || `${Math.ceil((p.content?.length || 500) / 1000)} min read`,
  }))
}

function generateBlogListing(
  posts: BlogPost[],
  siteName: string,
  primary: string,
  bg: string,
  text: string,
  headingFont: string,
  bodyFont: string,
  description: string
): string {
  const postCards = posts.map((p, i) => `
    <article class="group rounded-2xl border overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg" style="background: ${bg}; border-color: ${primary}22">
      <div class="p-8">
        <div class="flex items-center gap-3 text-sm mb-4" style="color: ${primary}">
          <span class="px-3 py-1 rounded-full text-xs font-medium" style="background: ${primary}15">${p.category}</span>
          <span>${p.date}</span>
          <span>${p.readTime}</span>
        </div>
        <h2 class="text-2xl font-bold mb-3 leading-tight" style="font-family: '${headingFont}', sans-serif; color: ${text}">
          <a href="/blog/${p.slug}.html" class="hover:opacity-80 transition">${p.title}</a>
        </h2>
        <p class="mb-6" style="color: ${text}99">${p.description}</p>
        <div class="flex flex-wrap gap-2">
          ${p.tags.slice(0, 3).map(t => `<span class="px-2 py-1 text-xs rounded" style="background: ${text}08; color: ${text}77">${t}</span>`).join('\n          ')}
        </div>
      </div>
    </article>
  `).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog | ${siteName}</title>
  <meta name="description" content="Read the latest insights and updates from ${siteName}. ${description}">
  <meta property="og:title" content="Blog | ${siteName}">
  <meta property="og:description" content="Latest insights from ${siteName}">
  <meta property="og:type" content="website">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${headingFont.replace(' ', '+')}:wght@400;500;600;700&family=${bodyFont.replace(' ', '+')}:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: { extend: {
        colors: { primary: '${primary}', bg: '${bg}', text: '${text}' },
        fontFamily: { heading: ['${headingFont}', 'sans-serif'], body: ['${bodyFont}', 'sans-serif'] },
      }}
    }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: '${bodyFont}', sans-serif; background: ${bg}; color: ${text}; line-height: 1.6; }
    h1, h2, h3, h4 { font-family: '${headingFont}', sans-serif; }
    .prose h2 { font-size: 1.75rem; margin-top: 2.5rem; margin-bottom: 1rem; }
    .prose h3 { font-size: 1.25rem; margin-top: 1.5rem; margin-bottom: 0.75rem; }
    .prose p { margin-bottom: 1.25rem; line-height: 1.8; }
    .prose ul { margin-bottom: 1.25rem; padding-left: 1.5rem; }
    .prose li { margin-bottom: 0.5rem; }
    .prose blockquote { border-left: 4px solid ${primary}; padding-left: 1rem; margin: 1.5rem 0; font-style: italic; opacity: 0.85; }
    .prose strong { font-weight: 600; }
  </style>
</head>
<body>
  <header class="sticky top-0 z-50 backdrop-blur-md border-b" style="background: ${bg}dd; border-color: ${primary}22">
    <nav class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
      <a href="/" class="text-2xl font-bold" style="font-family: '${headingFont}', sans-serif; color: ${text}">${siteName}</a>
      <div class="hidden md:flex items-center gap-1">
        <a href="/" class="px-3 py-2 text-sm font-medium transition" style="color: ${text}99">Home</a>
        <a href="/blog/index.html" class="px-3 py-2 text-sm font-medium transition" style="color: ${text}">Blog</a>
        <a href="/contact.html" class="px-3 py-2 text-sm font-medium transition" style="color: ${text}99">Contact</a>
      </div>
    </nav>
  </header>

  <main>
    <section class="py-20 px-4 text-center" style="background: linear-gradient(180deg, ${primary}08 0%, transparent 100%)">
      <div class="max-w-4xl mx-auto">
        <h1 class="text-5xl md:text-6xl font-bold mb-6" style="font-family: '${headingFont}', sans-serif; color: ${text}">Our Blog</h1>
        <p class="text-xl" style="color: ${text}99">Insights, strategies, and stories from the ${siteName} team</p>
      </div>
    </section>

    <section class="py-16 px-4">
      <div class="max-w-6xl mx-auto">
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          ${postCards}
        </div>
      </div>
    </section>
  </main>

  <footer class="border-t py-12 px-4" style="background: ${text}08; border-color: ${primary}22">
    <div class="max-w-6xl mx-auto text-center">
      <p class="text-sm" style="color: ${text}77">&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`
}

function generateBlogPostPage(
  post: BlogPost,
  allPosts: BlogPost[],
  siteName: string,
  primary: string,
  bg: string,
  text: string,
  headingFont: string,
  bodyFont: string
): string {
  const recentLinks = allPosts
    .filter(p => p.slug !== post.slug)
    .slice(0, 3)
    .map(p => `
      <li class="mb-3">
        <a href="/blog/${p.slug}.html" class="hover:opacity-80 transition font-medium" style="color: ${primary}">
          ${p.title}
        </a>
        <span class="block text-sm mt-1" style="color: ${text}55">${p.date} · ${p.readTime}</span>
      </li>
    `).join('\n        ')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${post.title} | ${siteName} Blog</title>
  <meta name="description" content="${post.description}">
  <meta property="og:title" content="${post.title}">
  <meta property="og:description" content="${post.description}">
  <meta property="og:type" content="article">
  <meta property="article:published_time" content="${post.date}">
  <meta property="article:author" content="${post.author}">
  <meta property="article:tag" content="${post.tags.join(', ')}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${headingFont.replace(' ', '+')}:wght@400;500;600;700&family=${bodyFont.replace(' ', '+')}:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: { extend: {
        colors: { primary: '${primary}', bg: '${bg}', text: '${text}' },
        fontFamily: { heading: ['${headingFont}', 'sans-serif'], body: ['${bodyFont}', 'sans-serif'] },
      }}
    }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: '${bodyFont}', sans-serif; background: ${bg}; color: ${text}; line-height: 1.6; }
    h1, h2, h3, h4 { font-family: '${headingFont}', sans-serif; }
    .prose { max-width: 720px; margin: 0 auto; }
    .prose h2 { font-size: 1.75rem; margin-top: 2.5rem; margin-bottom: 1rem; color: ${text}; }
    .prose h3 { font-size: 1.25rem; margin-top: 1.5rem; margin-bottom: 0.75rem; color: ${text}; }
    .prose p { margin-bottom: 1.25rem; line-height: 1.8; color: ${text}dd; }
    .prose ul, .prose ol { margin-bottom: 1.25rem; padding-left: 1.5rem; color: ${text}dd; }
    .prose li { margin-bottom: 0.5rem; }
    .prose blockquote { border-left: 4px solid ${primary}; padding-left: 1.25rem; margin: 1.5rem 0; font-style: italic; color: ${text}aa; }
    .prose strong { font-weight: 600; color: ${text}; }
    @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; } }
  </style>
</head>
<body>
  <header class="sticky top-0 z-50 backdrop-blur-md border-b" style="background: ${bg}dd; border-color: ${primary}22">
    <nav class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
      <a href="/" class="text-2xl font-bold" style="font-family: '${headingFont}', sans-serif; color: ${text}">${siteName}</a>
      <div class="hidden md:flex items-center gap-1">
        <a href="/" class="px-3 py-2 text-sm font-medium transition" style="color: ${text}99">Home</a>
        <a href="/blog/index.html" class="px-3 py-2 text-sm font-medium transition" style="color: ${text}">Blog</a>
      </div>
    </nav>
  </header>

  <main class="max-w-6xl mx-auto px-4 py-16">
    <article>
      <header class="mb-12 text-center max-w-3xl mx-auto">
        <div class="flex items-center justify-center gap-4 text-sm mb-6" style="color: ${primary}">
          <span class="px-3 py-1 rounded-full text-xs font-medium" style="background: ${primary}15">${post.category}</span>
          <span>${post.date}</span>
          <span>${post.readTime}</span>
        </div>
        <h1 class="text-4xl md:text-5xl font-bold mb-6 leading-tight" style="font-family: '${headingFont}', sans-serif; color: ${text}">${post.title}</h1>
        <p class="text-xl" style="color: ${text}99">${post.description}</p>
        <div class="mt-6 text-sm" style="color: ${text}66">By ${post.author}</div>
      </header>

      <div class="prose">
        ${post.content}
      </div>

      <footer class="mt-16 pt-8 border-t max-w-3xl mx-auto" style="border-color: ${primary}22">
        <div class="flex flex-wrap gap-2 mb-8">
          ${post.tags.map(t => `<span class="px-3 py-1 text-sm rounded-full" style="background: ${text}08; color: ${text}77">${t}</span>`).join('\n          ')}
        </div>

        <div class="grid md:grid-cols-2 gap-8">
          <div>
            <h3 class="text-lg font-bold mb-4" style="font-family: '${headingFont}', sans-serif">Share this article</h3>
            <div class="flex gap-3">
              <a href="https://www.linkedin.com/share?url=${encodeURIComponent(`https://${siteName.toLowerCase().replace(/\s+/g, '-')}.vercel.app/blog/${post.slug}.html`)}" target="_blank" rel="noopener" class="px-4 py-2 text-sm rounded-lg transition" style="background: ${primary}15; color: ${primary}">LinkedIn</a>
              <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://${siteName.toLowerCase().replace(/\s+/g, '-')}.vercel.app/blog/${post.slug}.html`)}" target="_blank" rel="noopener" class="px-4 py-2 text-sm rounded-lg transition" style="background: ${primary}15; color: ${primary}">Twitter</a>
              <a href="https://www.facebook.com/sharer.php?u=${encodeURIComponent(`https://${siteName.toLowerCase().replace(/\s+/g, '-')}.vercel.app/blog/${post.slug}.html`)}" target="_blank" rel="noopener" class="px-4 py-2 text-sm rounded-lg transition" style="background: ${primary}15; color: ${primary}">Facebook</a>
            </div>
          </div>

          <div>
            <h3 class="text-lg font-bold mb-4" style="font-family: '${headingFont}', sans-serif">Recent Posts</h3>
            <ul class="space-y-3">
              ${recentLinks}
            </ul>
          </div>
        </div>

        <div class="mt-8 text-center">
          <a href="/blog/index.html" class="inline-flex items-center px-6 py-3 rounded-lg text-white font-medium transition hover:opacity-90" style="background: ${primary}">
            ← Back to Blog
          </a>
        </div>
      </footer>
    </article>
  </main>

  <footer class="border-t py-12 px-4" style="background: ${text}08; border-color: ${primary}22">
    <div class="max-w-6xl mx-auto text-center">
      <p class="text-sm" style="color: ${text}77">&copy; ${new Date().toLocaleDateString('en-US', { year: 'numeric' })} ${siteName}. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`
}
