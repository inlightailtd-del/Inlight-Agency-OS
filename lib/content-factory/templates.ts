// 5 branded SVG templates for Inlight Agency OS content factory
// Each produces a 1200×630 PNG optimized for social platforms

export type TemplateId = 'ai-automation' | 'ai-chatbots' | 'ai-voice' | 'ai-websites' | 'ai-marketing'

export interface TemplateInput {
  headline: string
  body: string
  stat?: string
  statLabel?: string
  date?: string
}

function gradient(from: string, to: string, dir = 'to bottom right') {
  return `<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" style="stop-color:${from}"/>
    <stop offset="100%" style="stop-color:${to}"/>
  </linearGradient>`
}

function bgTemplate(input: TemplateInput, accent: string, secondary: string, gradientDef: string, iconSvg: string) {
  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${gradientDef}
      <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:${accent}"/>
        <stop offset="100%" style="stop-color:${secondary}"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <rect x="0" y="0" width="1200" height="6" fill="url(#accent)"/>
    <g opacity="0.04">
      ${Array.from({length: 20}, (_, i) => `<line x1="${i*60}" y1="0" x2="${i*60}" y2="630" stroke="white" stroke-width="1"/>`).join('\n      ')}
      ${Array.from({length: 12}, (_, i) => `<line x1="0" y1="${i*60}" x2="1200" y2="${i*60}" stroke="white" stroke-width="1"/>`).join('\n      ')}
    </g>
    ${iconSvg}
    <text x="80" y="220" fill="white" font-family="Arial, sans-serif" font-size="44" font-weight="bold">${escapeXml(input.headline)}</text>
    <text x="80" y="260" fill="${secondary}" font-family="Arial, sans-serif" font-size="18">${escapeXml(input.body.substring(0, 120))}</text>
    ${input.stat ? `
    <rect x="80" y="290" width="60" height="4" fill="${accent}" rx="2"/>
    <text x="80" y="340" fill="white" font-family="Arial, sans-serif" font-size="52" font-weight="bold">${escapeXml(input.stat)}</text>
    <text x="80" y="370" fill="${secondary}" font-family="Arial, sans-serif" font-size="18">${escapeXml(input.statLabel||'')}</text>
    ` : `<rect x="80" y="290" width="60" height="4" fill="${accent}" rx="2"/>`}
    <text x="80" y="560" fill="#475569" font-family="Arial, sans-serif" font-size="14">INLIGHT AGENCY OS  ·  ${escapeXml(input.date||new Date().toLocaleDateString())}</text>
    <text x="1120" y="560" text-anchor="end" fill="${accent}" font-family="Arial, sans-serif" font-size="14">inlight.ai</text>
  </svg>`
}

function escapeXml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function iconGlobe(): string {
  return `<circle cx="80" cy="100" r="28" fill="none" stroke="#10b981" stroke-width="2.5"/>
    <ellipse cx="80" cy="100" rx="18" ry="10" fill="none" stroke="#10b981" stroke-width="1.5"/>
    <line x1="62" y1="100" x2="98" y2="100" stroke="#10b981" stroke-width="1.5"/>
    <text x="80" y="105" text-anchor="middle" fill="#10b981" font-family="Arial" font-size="14" font-weight="bold">AI</text>`
}

function iconChat(): string {
  return `<rect x="52" y="78" width="56" height="40" rx="8" fill="none" stroke="#8b5cf6" stroke-width="2.5"/>
    <polyline points="85,118 85,135 70,120" fill="none" stroke="#8b5cf6" stroke-width="2"/>
    <circle cx="68" cy="98" r="4" fill="#8b5cf6"/>
    <circle cx="80" cy="98" r="4" fill="#8b5cf6"/>
    <circle cx="92" cy="98" r="4" fill="#8b5cf6"/>`
}

function iconMic(): string {
  return `<path d="M80 70c-6 0-10 4-10 10v20c0 6 4 10 10 10s10-4 10-10V80c0-6-4-10-10-10z" fill="none" stroke="#f59e0b" stroke-width="2.5"/>
    <path d="M55 100c0 14 11 25 25 25s25-11 25-25" fill="none" stroke="#f59e0b" stroke-width="2.5"/>
    <line x1="80" y1="135" x2="80" y2="145" stroke="#f59e0b" stroke-width="2.5"/>`
}

function iconCode(): string {
  return `<path d="M45 85l15 20-15 20" fill="none" stroke="#3b82f6" stroke-width="2.5"/>
    <path d="M115 85l-15 20 15 20" fill="none" stroke="#3b82f6" stroke-width="2.5"/>
    <line x1="90" y1="75" x2="70" y2="145" stroke="#3b82f6" stroke-width="2" opacity="0.5"/>`
}

function iconRocket(): string {
  return `<path d="M80 50c-15 25-25 45-28 55l28 15 28-15c-3-10-13-30-28-55z" fill="none" stroke="#ec4899" stroke-width="2.5"/>
    <circle cx="80" cy="80" r="6" fill="#ec4899"/>
    <path d="M60 115l-10 10" stroke="#ec4899" stroke-width="2"/>
    <path d="M100 115l10 10" stroke="#ec4899" stroke-width="2"/>`
}

export function renderTemplate(id: TemplateId, input: TemplateInput): string {
  const templates: Record<TemplateId, { accent: string; secondary: string; gradient: string; icon: string }> = {
    'ai-automation': {
      accent: '#10b981', secondary: '#34d399',
      gradient: gradient('#0f172a', '#064e3b'),
      icon: iconRocket(),
    },
    'ai-chatbots': {
      accent: '#8b5cf6', secondary: '#a78bfa',
      gradient: gradient('#0f172a', '#3b0764'),
      icon: iconChat(),
    },
    'ai-voice': {
      accent: '#f59e0b', secondary: '#fbbf24',
      gradient: gradient('#0f172a', '#78350f'),
      icon: iconMic(),
    },
    'ai-websites': {
      accent: '#3b82f6', secondary: '#60a5fa',
      gradient: gradient('#0f172a', '#1e3a5f'),
      icon: iconCode(),
    },
    'ai-marketing': {
      accent: '#ec4899', secondary: '#f472b6',
      gradient: gradient('#0f172a', '#5b0e34'),
      icon: iconGlobe(),
    },
  }
  const t = templates[id]
  return bgTemplate(input, t.accent, t.secondary, t.gradient, t.icon)
}
