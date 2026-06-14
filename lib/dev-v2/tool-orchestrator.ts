import { execSync } from 'child_process'
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'

export interface ToolCall {
  tool: string
  args: Record<string, any>
}

export interface ToolResult {
  success: boolean
  output: string
  durationMs: number
}

export class ToolOrchestrationEngine {
  private supabase: any
  private userId: string
  private rootDir: string

  constructor(supabase: any, userId: string) {
    this.supabase = supabase
    this.userId = userId
    this.rootDir = process.cwd()
  }

  async execute(tool: string, args: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now()
    try {
      const result = await this.dispatch(tool, args)
      const durationMs = Date.now() - startTime
      return { ...result, durationMs }
    } catch (e: any) {
      return { success: false, output: e.message, durationMs: Date.now() - startTime }
    }
  }

  getAvailableTools(): { name: string; description: string; parameters: Record<string, string> }[] {
    return [
      { name: 'read_file', description: 'Read a file from the repository', parameters: { path: 'string (required)' } },
      { name: 'write_file', description: 'Create or overwrite a file', parameters: { path: 'string (required)', content: 'string (required)' } },
      { name: 'edit_file', description: 'Edit a specific section of a file', parameters: { path: 'string (required)', oldText: 'string (required)', newText: 'string (required)' } },
      { name: 'delete_file', description: 'Delete a file', parameters: { path: 'string (required)' } },
      { name: 'run_command', description: 'Run a shell command', parameters: { command: 'string (required)', timeout: 'number (optional, default 30000)' } },
      { name: 'run_build', description: 'Run npm run build', parameters: {} },
      { name: 'run_lint', description: 'Run npm run lint', parameters: {} },
      { name: 'run_tests', description: 'Run npm test', parameters: {} },
      { name: 'git_add', description: 'Stage all changes', parameters: {} },
      { name: 'git_commit', description: 'Commit staged changes', parameters: { message: 'string (required)' } },
      { name: 'git_status', description: 'Check git status', parameters: {} },
      { name: 'git_diff', description: 'Show file changes', parameters: { path: 'string (optional)' } },
      { name: 'list_directory', description: 'List files in a directory', parameters: { path: 'string (required)' } },
      { name: 'search_files', description: 'Search for files by glob pattern', parameters: { pattern: 'string (required)' } },
      { name: 'grep_search', description: 'Search for text in files', parameters: { pattern: 'string (required)', path: 'string (optional)' } },
      { name: 'install_dependency', description: 'Install an npm package', parameters: { package: 'string (required)', dev: 'boolean (optional)' } },
      { name: 'db_query', description: 'Run SQL query on Supabase', parameters: { query: 'string (required)' } },
      { name: 'db_migrate', description: 'Run database migration', parameters: { file: 'string (required)' } },
    ]
  }

  private async dispatch(tool: string, args: Record<string, any>): Promise<ToolResult> {
    switch (tool) {
      case 'read_file': return this.readFile(args.path)
      case 'write_file': return this.writeFile(args.path, args.content)
      case 'edit_file': return this.editFile(args.path, args.oldText, args.newText)
      case 'delete_file': return this.deleteFile(args.path)
      case 'run_command': return this.runCommand(args.command, args.timeout)
      case 'run_build': return this.runBuild()
      case 'run_lint': return this.runLint()
      case 'run_tests': return this.runTests()
      case 'git_add': return this.gitAdd()
      case 'git_commit': return this.gitCommit(args.message)
      case 'git_status': return this.gitStatus()
      case 'git_diff': return this.gitDiff(args.path)
      case 'list_directory': return this.listDirectory(args.path)
      case 'search_files': return this.searchFiles(args.pattern)
      case 'grep_search': return this.grepSearch(args.pattern, args.path)
      case 'install_dependency': return this.installDependency(args.package, args.dev)
      case 'db_query': return this.dbQuery(args.query)
      default: return { success: false, output: `Unknown tool: ${tool}`, durationMs: 0 }
    }
  }

  private async readFile(path: string): Promise<ToolResult> {
    const fullPath = join(this.rootDir, path)
    if (!existsSync(fullPath)) return { success: false, output: `File not found: ${path}`, durationMs: 0 }
    const content = readFileSync(fullPath, 'utf-8')
    return { success: true, output: content, durationMs: 0 }
  }

  private async writeFile(path: string, content: string): Promise<ToolResult> {
    const fullPath = join(this.rootDir, path)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, content, 'utf-8')
    return { success: true, output: `Written: ${path} (${content.length} bytes)`, durationMs: 0 }
  }

  private async editFile(path: string, oldText: string, newText: string): Promise<ToolResult> {
    const fullPath = join(this.rootDir, path)
    if (!existsSync(fullPath)) return { success: false, output: `File not found: ${path}`, durationMs: 0 }
    let content = readFileSync(fullPath, 'utf-8')
    if (!content.includes(oldText)) return { success: false, output: `Text not found in ${path}`, durationMs: 0 }
    content = content.replace(oldText, newText)
    writeFileSync(fullPath, content, 'utf-8')
    return { success: true, output: `Edited: ${path}`, durationMs: 0 }
  }

  private async deleteFile(path: string): Promise<ToolResult> {
    const fullPath = join(this.rootDir, path)
    if (!existsSync(fullPath)) return { success: false, output: `File not found: ${path}`, durationMs: 0 }
    unlinkSync(fullPath)
    return { success: true, output: `Deleted: ${path}`, durationMs: 0 }
  }

  private async runCommand(command: string, timeout = 30000): Promise<ToolResult> {
    try {
      const output = execSync(command, { cwd: this.rootDir, encoding: 'utf-8', timeout: Math.max(timeout, 5000) })
      return { success: true, output: output.substring(0, 5000), durationMs: 0 }
    } catch (e: any) {
      return { success: false, output: (e.stdout || e.stderr || e.message).substring(0, 5000), durationMs: 0 }
    }
  }

  private async runBuild(): Promise<ToolResult> {
    return this.runCommand('npm run build 2>&1', 120000)
  }

  private async runLint(): Promise<ToolResult> {
    return this.runCommand('npm run lint 2>&1', 60000)
  }

  private async runTests(): Promise<ToolResult> {
    return this.runCommand('npm test 2>&1', 60000)
  }

  private async gitAdd(): Promise<ToolResult> {
    return this.runCommand('git add .')
  }

  private async gitCommit(message: string): Promise<ToolResult> {
    try {
      execSync(`git -c user.name="ASE v2" -c user.email="ase@inlight.ai" commit -m "${message}"`, { cwd: this.rootDir, encoding: 'utf-8' })
      return { success: true, output: `Committed: ${message}`, durationMs: 0 }
    } catch (e: any) {
      return { success: false, output: (e.stderr || e.message), durationMs: 0 }
    }
  }

  private async gitStatus(): Promise<ToolResult> {
    return this.runCommand('git status --short')
  }

  private async gitDiff(path?: string): Promise<ToolResult> {
    const cmd = path ? `git diff -- "${path}"` : 'git diff --stat'
    return this.runCommand(cmd)
  }

  private async listDirectory(path: string): Promise<ToolResult> {
    const fullPath = join(this.rootDir, path)
    if (!existsSync(fullPath)) return { success: false, output: `Directory not found: ${path}`, durationMs: 0 }
    const { readdirSync } = await import('fs')
    const entries = readdirSync(fullPath, { withFileTypes: true })
    const files = entries.filter(e => e.isFile()).map(e => e.name)
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name + '/')
    return { success: true, output: [...dirs, ...files].join('\n'), durationMs: 0 }
  }

  private async searchFiles(pattern: string): Promise<ToolResult> {
    try {
      const output = execSync(`dir /b /s "${this.rootDir}\\${pattern.replace(/\//g, '\\')}"`, { encoding: 'utf-8', timeout: 10000 })
      return { success: true, output: output.substring(0, 5000), durationMs: 0 }
    } catch {
      return { success: false, output: 'No matches found', durationMs: 0 }
    }
  }

  private async grepSearch(pattern: string, path?: string): Promise<ToolResult> {
    const dir = path ? join(this.rootDir, path) : this.rootDir
    try {
      const output = execSync(`findstr /s /n /c:"${pattern}" "${dir}\\*.ts" "${dir}\\*.tsx" 2>&1`, { encoding: 'utf-8', timeout: 10000 })
      return { success: true, output: output.substring(0, 5000), durationMs: 0 }
    } catch {
      return { success: false, output: 'No matches found', durationMs: 0 }
    }
  }

  private async installDependency(pkg: string, dev?: boolean): Promise<ToolResult> {
    const flag = dev ? '--save-dev' : '--save'
    return this.runCommand(`npm install ${flag} ${pkg}`, 60000)
  }

  private async dbQuery(query: string): Promise<ToolResult> {
    try {
      const output = execSync(`npx supabase db query --linked "${query}"`, { cwd: this.rootDir, encoding: 'utf-8', timeout: 30000 })
      return { success: true, output: output.substring(0, 5000), durationMs: 0 }
    } catch (e: any) {
      return { success: false, output: (e.stderr || e.stdout || e.message).substring(0, 2000), durationMs: 0 }
    }
  }
}
