import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpPetRepository } from './httpRepository'

describe('HTTP pet repository', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns undefined when getPet receives a 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: '宠物不存在' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    const repository = createHttpPetRepository('/api')

    await expect(repository.getPet('missing')).resolves.toBeUndefined()
  })

  it('keeps throwing non-404 API failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: '数据库暂不可用' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    const repository = createHttpPetRepository('/api')

    await expect(repository.getPet('pet-doubao')).rejects.toThrow('数据库暂不可用')
  })
})
