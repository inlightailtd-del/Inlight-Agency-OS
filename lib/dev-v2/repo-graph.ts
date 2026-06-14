import { readFileSync, statSync, existsSync, readdirSync } from 'fs'
import { join, extname, relative } from 'path'
import type { RepoNode } from './types'

const IMPORT_PATTERNS = [
  /from\s+['"]([^'"]+)['"]/g,
  /import\s+['"]([^'"]+)['"]/g,
  /require\(['"]([^'"]+)['"]\)/g,
  /import\s*\(['"]([^'"]+)['"]\)/g,
]

export class RepoGraphEngine {
  private rootDir: string
  private supabase: any
  private userId: string
  private graph: Map<string, RepoNode> = new Map()
  private excludeDirs = ['node_modules', '.next', '.git', 'dist', 'build', '.cache', 'coverage', 'public']
  private includeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']

  constructor(supabase: any, userId: string) {
    this.supabase = supabase
    this.userId = userId
    this.rootDir = process.cwd()
  }

  async scan(): Promise<{ nodes: RepoNode[]; totalFiles: number; totalDirs: number }> {
    const files = this.collectFiles(this.rootDir, '')
    const nodes: RepoNode[] = []

    for (const file of files) {
      const node = this.analyzeFile(file)
      if (node) {
        this.graph.set(node.filePath, node)
        nodes.push(node)
      }
    }

    // Resolve cross-references
    for (const node of nodes) {
      for (const imp of node.imports) {
        const resolved = this.resolveImport(node.filePath, imp)
        if (resolved && this.graph.has(resolved)) {
          const target = this.graph.get(resolved)!
          target.dependents.push(node.filePath)
          node.dependencies.push(resolved)
        }
      }
    }

    // Store to DB
    for (const node of nodes) {
      await this.supabase.from('dev_repo_graph').upsert([{
        user_id: this.userId,
        file_path: node.filePath,
        file_type: node.fileType,
        imports: node.imports,
        exported_by: node.exportedBy,
        dependencies: node.dependencies,
        dependents: node.dependents,
        size_bytes: node.sizeBytes,
        hash: node.hash,
        last_modified: new Date().toISOString(),
      }], { onConflict: 'user_id,file_path', ignoreDuplicates: false })
    }

    return {
      nodes,
      totalFiles: nodes.length,
      totalDirs: new Set(nodes.map(n => n.filePath.split('/').slice(0, -1).join('/'))).size,
    }
  }

  async getDependents(filePath: string): Promise<string[]> {
    const { data } = await this.supabase
      .from('dev_repo_graph')
      .select('dependents')
      .eq('user_id', this.userId)
      .eq('file_path', filePath)
      .single()
    return (data as any)?.dependents || []
  }

  async getDependencies(filePath: string): Promise<string[]> {
    const { data } = await this.supabase
      .from('dev_repo_graph')
      .select('dependencies')
      .eq('user_id', this.userId)
      .eq('file_path', filePath)
      .single()
    return (data as any)?.dependencies || []
  }

  async getAffectedFiles(changedPaths: string[]): Promise<Set<string>> {
    const affected = new Set(changedPaths)
    const queue = [...changedPaths]

    while (queue.length > 0) {
      const path = queue.pop()!
      const dependents = await this.getDependents(path)
      for (const dep of dependents) {
        if (!affected.has(dep)) {
          affected.add(dep)
          queue.push(dep)
        }
      }
    }

    return affected
  }

  private collectFiles(dir: string, relativeDir: string): string[] {
    const files: string[] = []
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.') || this.excludeDirs.includes(entry.name)) continue
        const fullPath = join(dir, entry.name)
        const relPath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          files.push(...this.collectFiles(fullPath, relPath))
        } else if (entry.isFile() && this.includeExtensions.includes(extname(entry.name))) {
          files.push(relPath)
        }
      }
    } catch {}
    return files
  }

  private analyzeFile(filePath: string): RepoNode | null {
    const fullPath = join(this.rootDir, filePath)
    if (!existsSync(fullPath)) return null

    const content = readFileSync(fullPath, 'utf-8')
    const stats = statSync(fullPath)
    const imports = this.extractImports(content)
    const exports = this.extractExports(content)

    return {
      filePath,
      fileType: extname(filePath).slice(1),
      imports: [...new Set(imports)],
      exportedBy: exports,
      dependencies: [],
      dependents: [],
      sizeBytes: stats.size,
      hash: this.simpleHash(content),
    }
  }

  private extractImports(content: string): string[] {
    const imports: string[] = []
    for (const pattern of IMPORT_PATTERNS) {
      let match: RegExpExecArray | null
      pattern.lastIndex = 0
      while ((match = pattern.exec(content)) !== null) {
        if (match[1] && !match[1].startsWith('@') && !match[1].startsWith('node:') && !match[1].startsWith('.')) {
          imports.push(match[1])
        }
        if (match[1] && (match[1].startsWith('./') || match[1].startsWith('../'))) {
          imports.push(match[1])
        }
      }
    }
    return imports
  }

  private extractExports(content: string): string[] {
    const exports: string[] = []
    const patterns = [/export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g, /export\s*\{([^}]+)\}/g]
    for (const pattern of patterns) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(content)) !== null) {
        exports.push(match[1].trim())
      }
    }
    return exports
  }

  private resolveImport(fromFile: string, importPath: string): string | null {
    if (!importPath.startsWith('.')) return null
    const dir = join(this.rootDir, fromFile, '..')
    const resolved = join(dir, importPath)
    const candidates = [resolved, `${resolved}.ts`, `${resolved}.tsx`, `${resolved}.js`, `${resolved}.jsx`, join(resolved, 'index.ts'), join(resolved, 'index.tsx'), join(resolved, 'index.js')]
    for (const candidate of candidates) {
      if (existsSync(candidate)) return relative(this.rootDir, candidate).replace(/\\/g, '/')
    }
    return null
  }

  private simpleHash(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0
    }
    return Math.abs(hash).toString(36)
  }
}

// Need readdirSync
