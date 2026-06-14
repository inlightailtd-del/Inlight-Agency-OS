import { describe, it, expect } from 'vitest'
import * as Subject from '@/ai/content-engine'

describe('content-engine.ts', () => {
  it('should export expected API', () => {
    expect(Subject).toBeDefined()
  })
})
