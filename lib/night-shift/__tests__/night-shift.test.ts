import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GitOperations } from '../git-operations'
import { NightShiftDaemon } from '../daemon'
import type { SupabaseClient } from '@supabase/supabase-js'

const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
} as unknown as SupabaseClient

const userId = 'test-user-id'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── GitOperations ─────────────────────────────────────────────
describe('GitOperations', () => {
  it('constructs with default cwd', () => {
    const git = new GitOperations()
    expect(git).toBeInstanceOf(GitOperations)
  })

  it('hasChanges returns false when working tree is clean', async () => {
    const git = new GitOperations()
    vi.spyOn(git as any, 'gitExec').mockReturnValue('')
    expect(await git.hasChanges()).toBe(false)
  })

  it('hasChanges returns true when dirty', async () => {
    const git = new GitOperations()
    vi.spyOn(git as any, 'gitExec').mockReturnValue(' M src/index.ts\n')
    expect(await git.hasChanges()).toBe(true)
  })

  it('getCurrentBranch returns branch name', async () => {
    const git = new GitOperations()
    vi.spyOn(git as any, 'gitExec').mockReturnValue('main')
    expect(await git.getCurrentBranch()).toBe('main')
  })

  it('listBranches parses git branch output', async () => {
    const git = new GitOperations()
    vi.spyOn(git as any, 'gitExec')
      .mockReturnValueOnce('main|abc123||2025-01-01\nfeature/test|def456||2025-01-02')
      .mockReturnValueOnce('main')
    const branches = await git.listBranches()
    expect(branches).toHaveLength(2)
    expect(branches[0].name).toBe('main')
    expect(branches[0].isDefault).toBe(true)
  })

  it('createBranch calls git checkout -b and returns branch info', async () => {
    const git = new GitOperations()
    const execMock = vi.spyOn(git as any, 'gitExec')
      .mockReturnValueOnce('')       // checkout -b
      .mockReturnValueOnce('sha123') // rev-parse HEAD
      .mockReturnValueOnce('')       // checkout back
    vi.spyOn(git, 'getCurrentBranch').mockResolvedValue('feature/test')
    const result = await git.createBranch('feature/test', 'main')
    expect(result.name).toBe('feature/test')
    expect(execMock).toHaveBeenCalledWith(expect.stringContaining('checkout -b'))
  })

  it('commit calls add -A, commit, rev-parse, log-1, diff-tree', async () => {
    const git = new GitOperations()
    vi.spyOn(git as any, 'gitExec')
      .mockReturnValueOnce('')          // git add -A
      .mockReturnValueOnce('')          // git commit
      .mockReturnValueOnce('abc123')    // git rev-parse HEAD
      .mockReturnValueOnce('2025-01-01T00:00:00Z')  // git log -1
      .mockReturnValueOnce('src/index.ts\nsrc/utils.ts') // diff-tree
    const commit = await git.commit('Test commit')
    expect(commit.sha).toBe('abc123')
    expect(commit.message).toBe('Test commit')
    expect(commit.files).toEqual(['src/index.ts', 'src/utils.ts'])
  })

  it('commit with specific files adds them individually', async () => {
    const git = new GitOperations()
    const execMock = vi.spyOn(git as any, 'gitExec')
      .mockReturnValueOnce('')          // git add src/index.ts
      .mockReturnValueOnce('')          // git add src/utils.ts
      .mockReturnValueOnce('')          // git commit
      .mockReturnValueOnce('def456')    // rev-parse HEAD
      .mockReturnValueOnce('2025-01-01T00:00:00Z')  // log -1
      .mockReturnValueOnce('src/index.ts') // diff-tree
    const commit = await git.commit('Specific files', ['src/index.ts', 'src/utils.ts'])
    expect(commit.sha).toBe('def456')
    expect(execMock).toHaveBeenCalledWith('add "src/index.ts"')
    expect(execMock).toHaveBeenCalledWith('add "src/utils.ts"')
  })

  it('getDiffSummary returns diff output', async () => {
    const git = new GitOperations()
    vi.spyOn(git as any, 'gitExec').mockReturnValue('1 file changed, 10 insertions(+), 2 deletions(-)')
    expect(await git.getDiffSummary()).toContain('insertions')
  })

  it('push calls git push', async () => {
    const git = new GitOperations()
    const execMock = vi.spyOn(git as any, 'gitExec').mockReturnValue('')
    await git.push('main')
    expect(execMock).toHaveBeenCalledWith('push origin "main"')
  })

  it('pull calls git pull', async () => {
    const git = new GitOperations()
    const execMock = vi.spyOn(git as any, 'gitExec').mockReturnValue('')
    await git.pull('main')
    expect(execMock).toHaveBeenCalledWith('pull origin "main"')
  })
})

// ─── NightShiftDaemon ──────────────────────────────────────────
describe('NightShiftDaemon', () => {
  it('constructs with default config', () => {
    const daemon = new NightShiftDaemon(mockSupabase, userId)
    expect(daemon.getState().status).toBe('idle')
  })

  it('constructs with custom config', () => {
    const daemon = new NightShiftDaemon(mockSupabase, userId, { loopIntervalMs: 5000, maxConsecutiveErrors: 5 })
    expect(daemon.getState().config.loopIntervalMs).toBe(5000)
  })

  it('start transitions to running state', async () => {
    const daemon = new NightShiftDaemon(mockSupabase, userId, { loopIntervalMs: 1000 })
    expect((await daemon.start()).status).toBe('running')
  })

  it('start registers an interval', async () => {
    const spy = vi.spyOn(globalThis, 'setInterval')
    const daemon = new NightShiftDaemon(mockSupabase, userId, { loopIntervalMs: 1000 })
    await daemon.start()
    expect(spy).toHaveBeenCalled()
  })

  it('pause transitions to paused state', async () => {
    const daemon = new NightShiftDaemon(mockSupabase, userId)
    await daemon.start()
    expect((await daemon.pause()).status).toBe('paused')
  })

  it('resume restarts the loop', async () => {
    const daemon = new NightShiftDaemon(mockSupabase, userId, { loopIntervalMs: 1000 })
    await daemon.start()
    await daemon.pause()
    expect((await daemon.resume()).status).toBe('running')
  })

  it('stop transitions to stopped state', async () => {
    const daemon = new NightShiftDaemon(mockSupabase, userId)
    await daemon.start()
    expect((await daemon.stop()).status).toBe('stopped')
  })

  it('calls onLoop handler on each cycle', async () => {
    const daemon = new NightShiftDaemon(mockSupabase, userId, { loopIntervalMs: 100 })
    const handler = vi.fn()
    daemon.onLoop(handler)
    await daemon.start()
    vi.advanceTimersByTime(300)
    expect(handler).toHaveBeenCalled()
    await daemon.stop()
  })

  it('getMonitor returns monitor instance', () => {
    expect(new NightShiftDaemon(mockSupabase, userId).getMonitor()).toBeDefined()
  })

  it('setConfig updates config', async () => {
    const daemon = new NightShiftDaemon(mockSupabase, userId)
    await daemon.setConfig({ loopIntervalMs: 30000 })
    expect(daemon.getState().config.loopIntervalMs).toBe(30000)
  })
})
