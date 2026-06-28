import type { Memory } from '../../domain/types'

export type MemorySceneMode = 'galaxy' | 'growth'
export type Position3 = [number, number, number]

const hashString = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

export function getMemoryPosition(memory: Memory, index: number, mode: MemorySceneMode): Position3 {
  const jitter = hashString(memory.id)
  if (mode === 'growth') {
    return [
      -7.2 + index * 2.05,
      Math.sin(index * 0.86 + jitter) * 0.78,
      -Math.abs(index - 3.5) * 0.22 + jitter * 0.12,
    ]
  }

  const angle = index * 1.16 + jitter * 0.5
  const radius = 3.3 + (index % 3) * 0.72
  return [
    Math.cos(angle) * radius,
    Math.sin(index * 0.71 + jitter) * 1.9,
    Math.sin(angle) * radius * 0.62 - index * 0.08,
  ]
}

export function getParticleCount(viewportWidth: number, reducedMotion: boolean) {
  if (reducedMotion) return 0
  return viewportWidth < 720 ? 320 : 1100
}

export function seasonForDate(date: string): '春' | '夏' | '秋' | '冬' {
  const month = Number(date.slice(5, 7))
  if (month >= 3 && month <= 5) return '春'
  if (month >= 6 && month <= 8) return '夏'
  if (month >= 9 && month <= 11) return '秋'
  return '冬'
}
