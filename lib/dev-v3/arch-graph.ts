import { readFileSync, statSync, existsSync, readdirSync } from 'fs'
import { join, extname } from 'path'
import type { ArchModule } from './types'

export class ArchGraphEngine {
  private supabase: any
  private userId: string

  constructor(supabase: any, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  analyze(): ArchModule[] {
    const modules: ArchModule[] = []
    const dirs = ['lib', 'app/api', 'app/dashboard', 'components']

    for (const dir of dirs) {
      const fullDir = join(process.cwd(), dir)
      if (!existsSync(fullDir)) continue
      try {
        const files = this.walk(fullDir)
        for (const file of files.slice(0, 50)) {
          const mod = this.analyzeFile(file, dir)
          if (mod) modules.push(mod)
        }
      } catch {}
    }

    // Store to DB
    for (const m of modules) {
      this.supabase.from('dev_v3_arch_graph').upsert([{
        user_id: this.userId, module_name: m.moduleName, module_type: m.moduleType,
        file_path: m.filePath, imports: m.imports, exports: m.exports,
        complexity: m.complexity, quality_score: m.qualityScore,
      }], { onConflict: 'user_id,module_name', ignoreDuplicates: false }).catch(() => {})
    }

    return modules
  }

  getStats(): { totalModules: number; avgComplexity: number; totalImports: number; typeBreakdown: Record<string, number> } {
    const modules = this.analyze()
    const typeBreakdown: Record<string, number> = {}
    let totalComplexity = 0
    let totalImports = 0
    for (const m of modules) {
      typeBreakdown[m.moduleType] = (typeBreakdown[m.moduleType] || 0) + 1
      totalComplexity += m.complexity
      totalImports += m.imports.length
    }
    return {
      totalModules: modules.length,
      avgComplexity: modules.length ? Math.round(totalComplexity / modules.length) : 0,
      totalImports,
      typeBreakdown,
    }
  }

  private walk(dir: string): string[] {
    const files: string[] = []
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        const full = join(dir, e.name)
        if (e.isDirectory()) {
          if (!['node_modules', '.next', '.git'].includes(e.name)) files.push(...this.walk(full))
        } else if (['.ts', '.tsx'].includes(extname(e.name))) {
          files.push(full)
        }
      }
    } catch {}
    return files
  }

  private analyzeFile(filePath: string, baseDir: string): ArchModule | null {
    const content = readFileSync(filePath, 'utf-8')
    const imports = [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1])
    const exports = [...content.matchAll(/export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g)].map(m => m[1])
    const complexity = this.calcComplexity(content)
    const relPath = filePath.replace(process.cwd() + '\\', '').replace(/\\/g, '/')
    const type = this.inferType(relPath)

    return {
      moduleName: relPath,
      moduleType: type,
      filePath: relPath,
      imports: [...new Set(imports)],
      exports: [...new Set(exports)],
      complexity,
      qualityScore: Math.max(0, Math.min(10, 10 - complexity / 5)),
    }
  }

  private calcComplexity(content: string): number {
    let score = 1
    score += (content.match(/if\s*\(/g) || []).length
    score += (content.match(/for\s*\(/g) || []).length
    score += (content.match(/while\s*\(/g) || []).length
    score += (content.match(/catch\s*\(/g) || []).length
    score += (content.match(/\|\|/g) || []).length
    score += (content.match(/&&/g) || []).length
    score += (content.match(/case\s+/g) || []).length
    return score
  }

  private inferType(path: string): string {
    if (path.startsWith('app/api')) return 'api'
    if (path.startsWith('app/dashboard')) return 'component'
    if (path.startsWith('components')) return 'component'
    if (path.startsWith('lib')) return 'lib'
    if (path.includes('migration')) return 'migration'
    return 'other'
  }
}
