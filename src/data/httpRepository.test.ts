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

  it('uploads assets through multipart requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'asset-1', url: '/api/assets/files/avatar.jpg' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const repository = createHttpPetRepository('/api') as ReturnType<typeof createHttpPetRepository> & {
      uploadAssets?: (files: File[], petId: string, kind: 'avatar') => Promise<string[]>
    }
    const file = new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' })

    expect(repository.uploadAssets).toBeTypeOf('function')
    await expect(repository.uploadAssets!([file], 'pet-doubao', 'avatar')).resolves.toEqual([
      '/api/assets/files/avatar.jpg',
    ])
    expect(fetchMock).toHaveBeenCalledWith('/api/assets', expect.objectContaining({
      method: 'POST',
      body: expect.any(FormData),
    }))
  })

  it('requests care events for a selected date', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const repository = createHttpPetRepository('/api')

    await repository.listCareEvents('pet-doubao', '2026-06-30')

    expect(fetchMock).toHaveBeenCalledWith('/api/pets/pet-doubao/care-events?date=2026-06-30', undefined)
  })

  it('creates and removes care events through the API', async () => {
    const event = {
      id: 'care-1',
      petId: 'pet-doubao',
      kind: 'feeding' as const,
      occurredAt: '2026-06-30T08:30',
      amount: 180,
      unit: 'g' as const,
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(event), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const repository = createHttpPetRepository('/api')

    await expect(repository.addCareEvent({
      petId: event.petId,
      kind: event.kind,
      occurredAt: event.occurredAt,
      amount: event.amount,
      unit: event.unit,
    })).resolves.toEqual(event)
    await repository.removeCareEvent(event.id)

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/pets/pet-doubao/care-events', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        petId: event.petId,
        kind: event.kind,
        occurredAt: event.occurredAt,
        amount: event.amount,
        unit: event.unit,
      }),
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/care-events/care-1', { method: 'DELETE' })
  })
})
