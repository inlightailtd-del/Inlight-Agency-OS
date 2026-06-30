import type { SupabaseClient } from '@supabase/supabase-js'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'
import type { LandingPageSpec } from './landing-page-builder'
import type { DesignSystem } from './design-ai'
import type { ThemeConfig } from './theme-generator'
import type { WireframeBlueprint } from './wireframe-generator'
import { generateBlogForSite } from './blog-generator'

export interface GeneratedSite {
  projectId: string
  files: { path: string; content: string; type: string }[]
  pages: number
  totalSize: number
  generatedAt: string
}

export async function generateWebsiteCode(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<GeneratedSite | null> {
  const { data: project } = await supabase
    .from('website_projects')
    .select('id, name, website_type, description, pages, landing_page_spec, design_system, theme_config, wireframe_blueprint')
    .eq('id', projectId)
    .single()

  if (!project) return null

  const spec = project.landing_page_spec as LandingPageSpec | null
  const design = project.design_system as DesignSystem | null
  const theme = project.theme_config as ThemeConfig | null
  const wireframe = project.wireframe_blueprint as WireframeBlueprint | null

  const files: { path: string; content: string; type: string }[] = []
  const pages = project.pages || 1
  const siteName = project.name || 'Website'
  const siteType = project.website_type || 'business'
  const description = project.description || ''
  const title = siteName

  const designColors = design?.colors
  const themeColors = theme?.colors?.light
  const primary = themeColors?.primary || designColors?.primary || '#3b82f6'
  const bg = themeColors?.background || designColors?.background || '#ffffff'
  const text = themeColors?.text || designColors?.text || '#0f172a'
  const headingFont = theme?.fonts?.heading || 'Inter'
  const bodyFont = theme?.fonts?.body || 'Inter'
  const style = theme?.style || 'modern'
  const navItems = wireframe?.globalElements?.navigation || ['Home', 'About', 'Services', 'Contact']

  const baseHtml = await generateHtmlPage(supabase, userId, {
    title, description, siteName, siteType, pagePath: '/',
    isHome: true, spec, design, theme, wireframe,
  })
  if (!baseHtml) return null

  files.push({ path: '/index.html', content: baseHtml, type: 'text/html' })
  files.push({ path: '/404.html', content: generate404Page(siteName, primary, bg, text, headingFont, bodyFont, navItems), type: 'text/html' })

  if (wireframe?.pages) {
    for (const page of wireframe.pages) {
      if (page.path === '/' || !page.path) continue
      const cleanPath = page.path.endsWith('/') ? `${page.path}index.html` : `${page.path}.html`
      const html = generateSubPage(siteName, page.name || 'Page', primary, bg, text, headingFont, bodyFont, navItems)
      files.push({ path: cleanPath, content: html, type: 'text/html' })
    }
  }

  const blogData = await generateBlogForSite(supabase, userId, projectId, siteName, siteType, design, theme, description)
  if (blogData) {
    files.push({ path: '/blog/index.html', content: blogData.listingHtml, type: 'text/html' })
    for (const page of blogData.postPages) {
      files.push({ path: page.path, content: page.content, type: 'text/html' })
    }
  }

  const css = generateTailwindConfig(design, theme)
  files.push({ path: '/tailwind.config.js', content: css, type: 'application/javascript' })

  const headers = generateHeadersConfig()
  files.push({ path: '/_headers', content: headers, type: 'text/plain' })

  const totalSize = files.reduce((s, f) => s + f.content.length, 0)

  const generated: GeneratedSite = {
    projectId, files, pages: files.length, totalSize,
    generatedAt: new Date().toISOString(),
  }

  await supabase.from('website_projects').update({
    generated_code: files.map(f => ({ path: f.path, type: f.type, size: f.content.length })),
    generated_at: new Date().toISOString(),
  }).eq('id', projectId)

  const fileRecords = files.map(f => ({
    user_id: userId, project_id: projectId,
    path: f.path, content: f.content, type: f.type, size: f.content.length,
  }))
  await supabase.from('website_project_files').insert(fileRecords)

  await storeMemory(supabase, userId, {
    category: 'website_learning',
    tags: [projectId, 'code_generated', siteType],
    content: {
      projectId, siteName, siteType,
      fileCount: files.length, totalSize,
      pages: wireframe?.pages?.length || 1,
      generatedAt: generated.generatedAt,
    },
  })

  return generated
}

interface PageContext {
  title: string
  description: string
  siteName: string
  siteType: string
  pagePath: string
  isHome: boolean
  spec: LandingPageSpec | null
  design: DesignSystem | null
  theme: ThemeConfig | null
  wireframe: WireframeBlueprint | null
  currentPage?: WireframeBlueprint['pages'][0]
}

async function generateHtmlPage(
  supabase: SupabaseClient,
  userId: string,
  ctx: PageContext
): Promise<string | null> {
  const designColors = ctx.design?.colors
  const themeColors = ctx.theme?.colors?.light
  const primary = themeColors?.primary || designColors?.primary || '#3b82f6'
  const bg = themeColors?.background || designColors?.background || '#ffffff'
  const text = themeColors?.text || designColors?.text || '#0f172a'
  const headingFont = ctx.theme?.fonts?.heading || 'Inter'
  const bodyFont = ctx.theme?.fonts?.body || 'Inter'
  const style = ctx.theme?.style || 'modern'
  const navItems = ctx.wireframe?.globalElements?.navigation || ['Home', 'About', 'Services', 'Contact']

  const sectionsJson = JSON.stringify(ctx.spec?.sections || [])

  const systemPrompt = `You are a Senior Frontend Developer. Generate a complete, production-ready HTML5 page with Tailwind CSS (loaded from CDN). Return ONLY the raw HTML code — no markdown, no \`\`\` tags.

Requirements:
- Use Tailwind CSS from CDN: <script src="https://cdn.tailwindcss.com"></script>
- Configure Tailwind with these colors via the \`tailwind.config\` script:
  primary: '${primary}', background: '${bg}', text: '${text}'
- Use Google Fonts: ${headingFont} for headings, ${bodyFont} for body
- Responsive design (mobile-first)
- Proper semantic HTML5 elements
- SEO meta tags with title: "${ctx.title}" and description: "${ctx.description}"
- Open Graph meta tags
- ${ctx.isHome ? 'Full landing page design' : 'Standard page layout with navigation and footer'}
- ${style === 'modern' ? 'Modern design with clean gradients and glassmorphism cards' : style === 'minimal' ? 'Clean minimal design with lots of whitespace' : style === 'bold' ? 'Bold, striking design with strong colors' : 'Professional corporate design'}
- Navigation bar with links: ${navItems.join(', ')}
- Footer with copyright and links
- Mobile hamburger menu
- Smooth scroll animations
- Contact form section
- ${ctx.isHome && ctx.spec?.sections?.length ? `Include these sections: ${ctx.spec.sections.map(s => s.type + ': ' + s.title).join(', ')}` : ''}

The code must be complete, valid, and immediately deployable. No placeholders, no lorem ipsum.`

  const result = await executeAgentTask(supabase, userId, null,
    `Generate a ${ctx.siteType} website page at ${ctx.pagePath} for "${ctx.siteName}".
     ${ctx.isHome ? 'This is the homepage.' : `This is the ${ctx.currentPage?.name || 'subpage'} page. Purpose: ${ctx.currentPage?.purpose || ''}`}
     Sections: ${sectionsJson}`,
    { systemPrompt }
  )

  let html = (result.response || '').trim()
  html = html.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim()
  if (!html || html.length < 200) {
    return generateFallbackPage(ctx, primary, bg, text, headingFont, bodyFont, navItems)
  }

  return html
}

function generateFallbackPage(
  ctx: PageContext,
  primary: string,
  bg: string,
  text: string,
  headingFont: string,
  bodyFont: string,
  navItems: string[]
): string {
  const navLinks = navItems.map(item =>
    `<a href="/${item.toLowerCase() === 'home' ? '' : item.toLowerCase()}" class="text-gray-300 hover:text-white transition px-3 py-2 text-sm font-medium">${item}</a>`
  ).join('\n          ')

  const sections = ctx.spec?.sections?.map(s => {
    if (s.type === 'hero') {
      return `<section class="relative overflow-hidden py-24 px-4">
        <div class="max-w-6xl mx-auto text-center">
          <h1 class="text-5xl md:text-6xl font-bold mb-6" style="font-family: '${headingFont}', sans-serif; color: ${text}">${s.title}</h1>
          ${s.subtitle ? `<p class="text-xl md:text-2xl mb-8" style="color: ${text}cc">${s.subtitle}</p>` : ''}
          <p class="text-lg max-w-3xl mx-auto mb-10" style="color: ${text}99">${s.content}</p>
          ${s.cta ? `<a href="${s.cta.href}" class="inline-flex items-center px-8 py-4 text-lg font-semibold rounded-lg text-white transition-all hover:opacity-90" style="background: ${primary}">${s.cta.text}</a>` : ''}
        </div>
      </section>`
    }
    if (s.type === 'features' && s.items) {
      return `<section class="py-20 px-4" style="background: ${bg}">
        <div class="max-w-6xl mx-auto">
          <h2 class="text-3xl md:text-4xl font-bold text-center mb-4" style="font-family: '${headingFont}', sans-serif; color: ${text}">${s.title}</h2>
          ${s.subtitle ? `<p class="text-lg text-center mb-12" style="color: ${text}99">${s.subtitle}</p>` : ''}
          <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            ${s.items.map(item => `<div class="p-6 rounded-2xl backdrop-blur-sm border transition-all hover:-translate-y-1" style="background: ${bg}cc; border-color: ${primary}33">
              <h3 class="text-xl font-semibold mb-3" style="color: ${text}">${item.title}</h3>
              <p style="color: ${text}99">${item.description}</p>
            </div>`).join('\n            ')}
          </div>
        </div>
      </section>`
    }
    if (s.type === 'pricing' && s.items) {
      return `<section class="py-20 px-4" style="background: ${bg}">
        <div class="max-w-6xl mx-auto">
          <h2 class="text-3xl md:text-4xl font-bold text-center mb-4" style="font-family: '${headingFont}', sans-serif; color: ${text}">${s.title}</h2>
          ${s.subtitle ? `<p class="text-lg text-center mb-12" style="color: ${text}99">${s.subtitle}</p>` : ''}
          <div class="grid md:grid-cols-3 gap-8">
            ${s.items.map(item => `<div class="p-8 rounded-2xl border text-center" style="border-color: ${primary}33">
              <h3 class="text-2xl font-bold mb-4" style="color: ${text}">${item.title}</h3>
              <p style="color: ${text}99">${item.description}</p>
            </div>`).join('\n            ')}
          </div>
        </div>
      </section>`
    }
    if (s.type === 'cta') {
      return `<section class="py-24 px-4" style="background: linear-gradient(135deg, ${primary}, ${primary}aa)">
        <div class="max-w-4xl mx-auto text-center">
          <h2 class="text-4xl font-bold mb-6 text-white" style="font-family: '${headingFont}', sans-serif">${s.title}</h2>
          <p class="text-xl text-white/90 mb-8">${s.content}</p>
          ${s.cta ? `<a href="${s.cta.href}" class="inline-flex items-center px-8 py-4 text-lg font-semibold rounded-lg bg-white transition-all hover:bg-gray-100" style="color: ${primary}">${s.cta.text}</a>` : ''}
        </div>
      </section>`
    }
    return ''
  }).join('\n\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${ctx.title}</title>
  <meta name="description" content="${ctx.description}">
  <meta property="og:title" content="${ctx.title}">
  <meta property="og:description" content="${ctx.description}">
  <meta property="og:type" content="website">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${headingFont.replace(' ', '+')}:wght@400;500;600;700&family=${bodyFont.replace(' ', '+')}:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: { primary: '${primary}', bg: '${bg}', text: '${text}' },
          fontFamily: { heading: ['${headingFont}', 'sans-serif'], body: ['${bodyFont}', 'sans-serif'] },
        }
      }
    }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: '${bodyFont}', sans-serif; background: ${bg}; color: ${text}; line-height: 1.6; }
    h1, h2, h3, h4 { font-family: '${headingFont}', sans-serif; }
    @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; } }
  </style>
</head>
<body>
  <header class="sticky top-0 z-50 backdrop-blur-md border-b" style="background: ${bg}dd; border-color: ${primary}22">
    <nav class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
      <a href="/" class="text-2xl font-bold" style="font-family: '${headingFont}', sans-serif; color: ${text}">${ctx.siteName}</a>
      <div class="hidden md:flex items-center gap-1">
        ${navLinks}
      </div>
      <button id="menuBtn" class="md:hidden p-2" onclick="document.getElementById('mobileMenu').classList.toggle('hidden')">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
    </nav>
    <div id="mobileMenu" class="hidden md:hidden px-4 pb-4">
      ${navItems.map(item => `<a href="/${item.toLowerCase() === 'home' ? '' : item.toLowerCase()}" class="block py-2 text-sm" style="color: ${text}cc">${item}</a>`).join('\n        ')}
    </div>
  </header>

  <main>
    ${ctx.isHome ? sections : `<div class="max-w-6xl mx-auto px-4 py-16">
      <h1 class="text-4xl md:text-5xl font-bold mb-6" style="font-family: '${headingFont}', sans-serif">${ctx.currentPage?.name || 'Page'}</h1>
      <p class="text-lg mb-8" style="color: ${text}99">${ctx.currentPage?.purpose || ''}</p>
      <div class="prose max-w-none" style="color: ${text}">
        ${ctx.currentPage?.sections?.map(s => `<section class="mb-12">
          <h2 class="text-2xl font-bold mb-4">${s.name}</h2>
          <p>${s.notes}</p>
        </section>`).join('\n        ') || '<p>Content coming soon.</p>'}
      </div>
    </div>`}
  </main>

  <footer class="border-t py-12 px-4" style="background: ${text}08; border-color: ${primary}22">
    <div class="max-w-6xl mx-auto text-center">
      <p class="text-sm" style="color: ${text}77">&copy; ${new Date().getFullYear()} ${ctx.siteName}. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`
}

function generateSubPage(siteName: string, pageName: string, primary: string, bg: string, text: string, headingFont: string, bodyFont: string, navItems: string[]): string {
  const navLinks = navItems.map(item =>
    `<a href="/${item.toLowerCase() === 'home' ? '' : item.toLowerCase()}" class="text-gray-300 hover:text-white transition px-3 py-2 text-sm font-medium">${item}</a>`
  ).join('\n          ')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageName} | ${siteName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=${headingFont.replace(' ', '+')}:wght@400;600;700;800&family=${bodyFont.replace(' ', '+')}:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: '${bodyFont}', sans-serif; background: ${bg}; color: ${text}; line-height: 1.6; }
    h1, h2, h3, h4 { font-family: '${headingFont}', sans-serif; }
  </style>
</head>
<body>
  <header class="sticky top-0 z-50 backdrop-blur-md border-b" style="background: ${bg}dd; border-color: ${primary}22">
    <nav class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
      <a href="/" class="text-2xl font-bold" style="font-family: '${headingFont}', sans-serif; color: ${text}">${siteName}</a>
      <div class="hidden md:flex items-center gap-1">
        ${navLinks}
      </div>
      <button id="menuBtn" class="md:hidden p-2" onclick="document.getElementById('mobileMenu').classList.toggle('hidden')">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
    </nav>
    <div id="mobileMenu" class="hidden md:hidden px-4 pb-4">
      ${navItems.map(item => `<a href="/${item.toLowerCase() === 'home' ? '' : item.toLowerCase()}" class="block py-2 text-sm" style="color: ${text}cc">${item}</a>`).join('\n      ')}
    </div>
  </header>
  <main>
    <div class="max-w-6xl mx-auto px-4 py-16">
      <h1 class="text-4xl md:text-5xl font-bold mb-6" style="font-family: '${headingFont}', sans-serif">${pageName}</h1>
      <div class="prose max-w-none" style="color: ${text}">
        <p class="text-lg mb-8" style="color: ${text}99">Welcome to our ${pageName.toLowerCase()} page. We are dedicated to providing exceptional service and innovative solutions tailored to your needs.</p>
        <section class="mb-12">
          <h2 class="text-2xl font-bold mb-4" style="color: ${primary}">Our Approach</h2>
          <p>We combine cutting-edge technology with strategic thinking to deliver results that exceed expectations. Our team of experts works closely with you to understand your unique challenges and goals.</p>
        </section>
        <section class="mb-12">
          <h2 class="text-2xl font-bold mb-4" style="color: ${primary}">Why Choose Us</h2>
          <div class="grid md:grid-cols-3 gap-6 mt-6">
            <div class="p-6 rounded-xl" style="background: ${primary}08">
              <h3 class="text-lg font-semibold mb-2">Expert Team</h3>
              <p class="text-sm" style="color: ${text}99">Skilled professionals with years of industry experience.</p>
            </div>
            <div class="p-6 rounded-xl" style="background: ${primary}08">
              <h3 class="text-lg font-semibold mb-2">Proven Results</h3>
              <p class="text-sm" style="color: ${text}99">Track record of delivering measurable business outcomes.</p>
            </div>
            <div class="p-6 rounded-xl" style="background: ${primary}08">
              <h3 class="text-lg font-semibold mb-2">Innovation First</h3>
              <p class="text-sm" style="color: ${text}99">Always at the forefront of technology and best practices.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  </main>
  <footer class="border-t py-12 px-4" style="background: ${text}08; border-color: ${primary}22">
    <div class="max-w-6xl mx-auto text-center">
      <p class="text-sm" style="color: ${text}77">&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`
}

function generate404Page(siteName: string, primary: string, bg: string, text: string, headingFont: string, bodyFont: string, navItems: string[]): string {
  const navLinks = navItems.map(item =>
    `<a href="/${item.toLowerCase() === 'home' ? '' : item.toLowerCase()}" class="text-gray-300 hover:text-white transition px-3 py-2 text-sm font-medium">${item}</a>`
  ).join('\n          ')
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>404 | ${siteName}</title><script src="https://cdn.tailwindcss.com"></script></head><body style="background:${bg};color:${text};font-family:system-ui"><div class="min-h-screen flex items-center justify-center"><div class="text-center"><h1 class="text-8xl font-bold mb-4" style="color:${primary}">404</h1><p class="text-xl mb-8">Page not found</p><a href="/" class="px-6 py-3 rounded-lg text-white inline-block" style="background:${primary}">Go Home</a></div></div></body></html>`
}

function generateTailwindConfig(design: DesignSystem | null, theme: ThemeConfig | null): string {
  const tc = theme?.colors?.light
  const dc = design?.colors
  return `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./**/*.html'],
  theme: {
    extend: {
      colors: {
        primary: '${tc?.primary || dc?.primary || '#3b82f6'}',
        secondary: '${tc?.secondary || dc?.secondary || '#8b5cf6'}',
        accent: '${tc?.accent || dc?.accent || '#06b6d4'}',
        background: '${tc?.background || dc?.background || '#ffffff'}',
        text: '${tc?.text || dc?.text || '#0f172a'}',
        muted: '${tc?.muted || dc?.muted || '#64748b'}',
        surface: '${tc?.surface || dc?.background || '#f8fafc'}',
      },
      fontFamily: {
        heading: ['${theme?.fonts?.heading || design?.typography?.headings?.font || 'Inter'}', 'sans-serif'],
        body: ['${theme?.fonts?.body || design?.typography?.body?.font || 'Inter'}', 'sans-serif'],
      },
    },
  },
}`
}

function generateHeadersConfig(): string {
  return `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data: https:;`
}
