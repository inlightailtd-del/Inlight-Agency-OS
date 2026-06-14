import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, relative, extname } from 'path'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface RepoComponent {
  path: string
  type: 'lib' | 'api' | 'app' | 'db' | 'config'
  category: string       // agent | queue | integration | validation | reels | development | etc
  exports: string[]
  imports: string[]
  dependencies: string[] // project-relative deps
  size: number
  lineCount: number
}

export interface DependencyGraph {
  nodes: { path: string; type: string; category: string }[]
  edges: { from: string; to: string; type: 'import' | 'api' | 'db' }[]
}

export interface ArchitectureSummary {
  totalFiles: number
  totalDirs: number
  components: RepoComponent[]
  graph: DependencyGraph
  entryPoints: string[]
  apiRoutes: string[]
  libModules: string[]
  dbMigrations: string[]
  queueJobs: string[]
  dashboards: string[]
}

export class RepoIntelligenceEngine {
  private supabase: SupabaseClient
  private userId: string
  private rootDir: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
    this.rootDir = process.cwd()
  }

  async scan(): Promise<ArchitectureSummary> {
    const startTime = Date.now()
    this.components = []
    const edges: { from: string; to: string; type: 'import' | 'api' | 'db' }[] = []
    const entryPoints: string[] = []
    const apiRoutes: string[] = []
    const libModules: string[] = []
    const dbMigrations: string[] = []
    const queueJobs: string[] = []
    const dashboards: string[] = []

    // Scan lib directory
    this.scanDirectory('lib', 'lib', this.components, entryPoints)
    // Scan API routes
    this.scanDirectory('app/api', 'api', this.components, apiRoutes)
    // Scan dashboard pages
    this.scanDirectory('app/dashboard', 'app', this.components, dashboards)
    // Scan migrations
    this.scanDirectory('supabase/migrations', 'db', this.components, dbMigrations)

    // Build dependency edges
    for (const comp of this.components) {
      for (const imp of comp.imports) {
        if (imp.startsWith('./') || imp.startsWith('../')) {
          const resolved = this.resolveRelativeImport(comp.path, imp)
          if (resolved && this.components.some(c => c.path === resolved)) {
            edges.push({ from: comp.path, to: resolved, type: 'import' })
          }
        } else if (imp.startsWith('@/')) {
          const resolved = this.resolveAliasImport(imp)
          if (resolved && this.components.some(c => c.path === resolved)) {
            edges.push({ from: comp.path, to: resolved, type: 'import' })
          }
        }
      }
    }

    // Detect queue job types
    const queueFile = join(this.rootDir, 'lib', 'queue', 'queue.ts')
    if (existsSync(queueFile)) {
      const content = readFileSync(queueFile, 'utf-8')
      const matches = content.match(/\| '(\w+)'/g)
      if (matches) queueJobs.push(...matches.map(m => m.replace("| '", '').replace("'", '')))
    }

    const summary: ArchitectureSummary = {
      totalFiles: this.components.length,
      totalDirs: new Set(this.components.map(c => c.path.split('/').slice(0, -1).join('/'))).size,
      components: this.components,
      graph: { nodes: this.components.map(c => ({ path: c.path, type: c.type, category: c.category })), edges },
      entryPoints: [...new Set(entryPoints)],
      apiRoutes: [...new Set(apiRoutes)],
      libModules: [...new Set(libModules)],
      dbMigrations: [...new Set(dbMigrations)],
      queueJobs: [...new Set(queueJobs)],
      dashboards: [...new Set(dashboards)],
    }

    // Store in development memory
    await this.supabase.from('development_memory').insert([{
      user_id: this.userId,
      type: 'architecture',
      name: 'Repository Architecture Scan',
      description: `${this.components.length} files, ${summary.totalDirs} directories, ${edges.length} dependency edges`,
      content: {
        totalFiles: this.components.length,
        totalDirs: summary.totalDirs,
        libModules: summary.libModules.length,
        apiRoutes: summary.apiRoutes.length,
        dbMigrations: summary.dbMigrations.length,
        queueJobs: summary.queueJobs.length,
        dashboards: summary.dashboards.length,
        scannedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      },
      tags: ['development', 'repo-intelligence', 'architecture', 'scan'],
      status: 'active',
    }])

    return summary
  }

  private scanDirectory(dir: string, type: RepoComponent['type'], components: RepoComponent[], pathAccumulator: string[]) {
    const fullDir = join(this.rootDir, dir)
    if (!existsSync(fullDir)) return
    this.scanRecursive(fullDir, dir, type, components, pathAccumulator)
  }

  private scanRecursive(dir: string, relPrefix: string, type: RepoComponent['type'], components: RepoComponent[], pathAccumulator: string[]) {
    let entries: string[]
    try { entries = readdirSync(dir) } catch { return }

    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const relPath = join(relPrefix, entry).replace(/\\/g, '/')

      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          this.scanRecursive(fullPath, relPath, type, components, pathAccumulator)
        } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
          const content = readFileSync(fullPath, 'utf-8')
          const lines = content.split('\n')
          const imports: string[] = []
          const exports: string[] = []

          for (const line of lines) {
            const importMatch = line.match(/import .+ from ['"](.+?)['"]/)
            if (importMatch) imports.push(importMatch[1])
            if (line.match(/^export /) && !line.includes('from')) exports.push(line.trim())
          }

          const category = this.inferCategory(relPath)
          components.push({
            path: relPath,
            type,
            category,
            exports,
            imports,
            dependencies: [],
            size: stat.size,
            lineCount: lines.length,
          })

          if (entry === 'index.ts' || entry === 'page.tsx') pathAccumulator.push(relPath)
        }
      } catch {}
    }
  }

  private inferCategory(path: string): string {
    if (path.includes('/queue/')) return 'queue'
    if (path.includes('/integrations/')) return 'integrations'
    if (path.includes('/validation/')) return 'validation'
    if (path.includes('/reels/')) return 'reels'
    if (path.includes('/development/')) return 'development'
    if (path.includes('/ai/')) return 'ai'
    if (path.includes('/supabase/')) return 'supabase'
    if (path.includes('/growth/') || path.includes('/execution/')) return 'growth'
    if (path.includes('/content-')) return 'content'
    if (path.includes('/outreach/')) return 'outreach'
    if (path.includes('/voice/') || path.includes('/video/')) return 'media'
    if (path.includes('/sales/')) return 'sales'
    if (path.includes('/websites/') || path.includes('/software/')) return 'development'
    if (path.includes('/automation/')) return 'automation'
    return 'general'
  }

  private components: RepoComponent[] = [] // set during scan

  private resolveRelativeImport(fromPath: string, importPath: string): string | null {
    const fromDir = fromPath.split('/').slice(0, -1).join('/')
    const resolved = join(fromDir, importPath)
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
      const candidate = resolved + ext
      if (this.components.some(c => c.path === candidate.replace(/\\/g, '/'))) return candidate
    }
    return null
  }

  private resolveAliasImport(importPath: string): string | null {
    const aliased = importPath.replace('@/', '')
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
      const candidate = aliased + ext
      if (this.components.some(c => c.path === candidate)) return candidate
    }
    return null
  }

  async getComponentTree(): Promise<{ name: string; children: any[] }> {
    const { data } = await this.supabase
      .from('development_memory')
      .select('content')
      .eq('user_id', this.userId)
      .eq('type', 'architecture')
      .eq('name', 'Repository Architecture Scan')
      .order('created_at', { ascending: false })
      .limit(1)

    if (!data?.[0]) return { name: 'root', children: [] }
    const content = data[0].content as any
    return {
      name: 'Inlight Agency OS',
      children: [
        { name: 'lib', children: content.libModules?.map((m: string) => ({ name: m })) || [] },
        { name: 'api', children: content.apiRoutes?.map((m: string) => ({ name: m })) || [] },
        { name: 'migrations', count: content.dbMigrations || 0 },
        { name: 'jobs', count: content.queueJobs || 0 },
      ],
    }
  }
}
