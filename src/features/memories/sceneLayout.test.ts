import { describe, expect, it } from 'vitest'
import type { Memory } from '../../domain/types'
import { getMemoryPosition, getParticleCount, seasonForDate } from './sceneLayout'

const memory: Memory = {
  id: 'memory-stable-id',
  petId: 'pet-doubao',
  occurredAt: '2025-10-02',
  mood: '调皮',
  note: '把家里的纸箱都占领了。',
  photos: ['/assets/dog-avatar.jpg'],
  isHighlight: false,
}

describe('memory scene layout', () => {
  it('returns the same galaxy position for the same memory', () => {
    expect(getMemoryPosition(memory, 3, 'galaxy')).toEqual(getMemoryPosition(memory, 3, 'galaxy'))
  })

  it('places growth memories from left to right by index', () => {
    const first = getMemoryPosition(memory, 0, 'growth')
    const later = getMemoryPosition(memory, 5, 'growth')

    expect(later[0]).toBeGreaterThan(first[0])
  })

  it('reduces particles for mobile and reduced-motion users', () => {
    expect(getParticleCount(1440, false)).toBeGreaterThan(getParticleCount(390, false))
    expect(getParticleCount(1440, true)).toBe(0)
  })

  it('maps dates to seasons', () => {
    expect(seasonForDate('2026-04-05')).toBe('春')
    expect(seasonForDate('2026-07-20')).toBe('夏')
    expect(seasonForDate('2025-10-02')).toBe('秋')
    expect(seasonForDate('2026-01-01')).toBe('冬')
  })
})
