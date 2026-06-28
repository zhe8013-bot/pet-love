import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalPetRepository } from './repository'
import { createSeedState } from './seed'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  get length() {
    return this.data.size
  }

  clear() {
    this.data.clear()
  }

  getItem(key: string) {
    return this.data.get(key) ?? null
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.data.delete(key)
  }

  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
}

describe('local pet repository', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new MemoryStorage()
  })

  it('seeds three pets once and persists later edits', async () => {
    const repository = createLocalPetRepository(storage)
    const pets = await repository.listPets()

    expect(pets.map((pet) => pet.name)).toEqual(['豆包', '米粒', '糖糖'])

    await repository.updatePet(pets[0].id, { status: '今天超级开心' })
    const reloaded = createLocalPetRepository(storage)

    expect((await reloaded.getPet(pets[0].id))?.status).toBe('今天超级开心')
    expect((await reloaded.listPets()).length).toBe(3)
  })

  it('keeps medical records isolated by pet and newest first', async () => {
    const initialState = createSeedState()
    initialState.medicalRecords = []
    const repository = createLocalPetRepository(storage, initialState)
    const [dog, cat] = await repository.listPets()

    await repository.addMedicalRecord({
      petId: dog.id,
      visitDate: '2026-02-12',
      symptoms: '轻微咳嗽',
      diagnosis: '换季敏感',
      treatment: '观察与补水',
      medication: '',
      clinic: '暖爪动物医院',
      cost: 180,
      followUpDate: '',
      photos: [],
      status: 'recovered',
    })
    await repository.addMedicalRecord({
      petId: dog.id,
      visitDate: '2026-06-18',
      symptoms: '肠胃不适',
      diagnosis: '轻度消化不良',
      treatment: '清淡饮食三天',
      medication: '益生菌',
      clinic: '暖爪动物医院',
      cost: 260,
      followUpDate: '2026-06-25',
      photos: [],
      status: 'follow-up',
    })

    expect((await repository.listMedicalRecords(dog.id)).map((item) => item.visitDate)).toEqual([
      '2026-06-18',
      '2026-02-12',
    ])
    expect(await repository.listMedicalRecords(cat.id)).toEqual([])
  })

  it('summarizes consumption and returns weight entries chronologically', async () => {
    const initialState = createSeedState()
    initialState.consumptions = []
    initialState.weights = []
    const repository = createLocalPetRepository(storage, initialState)
    const [pet] = await repository.listPets()

    await repository.addConsumption({
      petId: pet.id,
      month: '2026-06',
      category: '主粮',
      quantity: 6,
      unit: 'kg',
      cost: 360,
    })
    await repository.addConsumption({
      petId: pet.id,
      month: '2026-06',
      category: '洗澡',
      quantity: 2,
      unit: '次',
      cost: 180,
    })
    await repository.addWeight({ petId: pet.id, measuredAt: '2026-06-20', weightKg: 31.8 })
    await repository.addWeight({ petId: pet.id, measuredAt: '2026-06-02', weightKg: 32.1 })

    expect(await repository.getMonthlySummary(pet.id, '2026-06')).toMatchObject({
      totalCost: 540,
      entryCount: 2,
    })
    expect((await repository.listWeights(pet.id)).map((item) => item.weightKg)).toEqual([32.1, 31.8])
  })
})
