import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn utility function', () => {
  it('merges class names correctly', () => {
    const result = cn('base-class', 'additional-class')
    expect(result).toContain('base-class')
    expect(result).toContain('additional-class')
  })

  it('handles conditional classes', () => {
    const result = cn('base-class', true && 'conditional-class', false && 'hidden-class')
    expect(result).toContain('base-class')
    expect(result).toContain('conditional-class')
    expect(result).not.toContain('hidden-class')
  })

  it('handles undefined and null values', () => {
    const result = cn('base-class', undefined, null, 'valid-class')
    expect(result).toContain('base-class')
    expect(result).toContain('valid-class')
  })

  it('handles empty string and falsy values', () => {
    const result = cn('base-class', '', 0, false, 'valid-class')
    expect(result).toContain('base-class')
    expect(result).toContain('valid-class')
  })
})