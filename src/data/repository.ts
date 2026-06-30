import type {
  CareEvent,
  ConsumptionEntry,
  MedicalRecord,
  Memory,
  MonthlySummary,
  NewCareEvent,
  NewConsumptionEntry,
  NewMedicalRecord,
  NewMemory,
  NewWeightEntry,
  Pet,
  PetDataState,
  WeightEntry,
} from '../domain/types'
import { filesToDataUrls } from '../lib/files'
import { createSeedState } from './seed'

const STORAGE_KEY = 'petplanet:data:v1'

const createId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`

export type AssetKind = 'avatar' | 'medical' | 'memory'

export interface PetRepository {
  uploadAssets(files: File[], petId: string, kind: AssetKind): Promise<string[]>
  listPets(): Promise<Pet[]>
  getPet(id: string): Promise<Pet | undefined>
  addPet(pet: Omit<Pet, 'id'>): Promise<Pet>
  updatePet(id: string, changes: Partial<Omit<Pet, 'id'>>): Promise<Pet>
  removePet(id: string): Promise<void>
  listMedicalRecords(petId: string): Promise<MedicalRecord[]>
  addMedicalRecord(record: NewMedicalRecord): Promise<MedicalRecord>
  removeMedicalRecord(id: string): Promise<void>
  listConsumptions(petId: string, month: string): Promise<ConsumptionEntry[]>
  addConsumption(entry: NewConsumptionEntry): Promise<ConsumptionEntry>
  removeConsumption(id: string): Promise<void>
  getMonthlySummary(petId: string, month: string): Promise<MonthlySummary>
  listWeights(petId: string): Promise<WeightEntry[]>
  addWeight(entry: NewWeightEntry): Promise<WeightEntry>
  removeWeight(id: string): Promise<void>
  listCareEvents(petId: string, date: string): Promise<CareEvent[]>
  addCareEvent(event: NewCareEvent): Promise<CareEvent>
  removeCareEvent(id: string): Promise<void>
  listMemories(petId: string): Promise<Memory[]>
  addMemory(memory: NewMemory): Promise<Memory>
  updateMemory(id: string, changes: Partial<Omit<Memory, 'id'>>): Promise<Memory>
  removeMemory(id: string): Promise<void>
}

export const createLocalPetRepository = (
  storage: Storage,
  initialState: PetDataState = createSeedState(),
): PetRepository => {
  const read = (): PetDataState => {
    const stored = storage.getItem(STORAGE_KEY)
    if (stored) {
      const state = JSON.parse(stored) as PetDataState
      state.careEvents ??= []
      return state
    }
    const seed = JSON.parse(JSON.stringify(initialState)) as PetDataState
    storage.setItem(STORAGE_KEY, JSON.stringify(seed))
    return seed
  }

  const write = (state: PetDataState) => {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  const mutate = <T>(change: (state: PetDataState) => T): T => {
    const state = read()
    const result = change(state)
    write(state)
    return result
  }

  return {
    async uploadAssets(files) {
      return filesToDataUrls(files)
    },
    async listPets() {
      return read().pets
    },
    async getPet(id) {
      return read().pets.find((pet) => pet.id === id)
    },
    async addPet(input) {
      return mutate((state) => {
        const pet = { ...input, id: createId('pet') }
        state.pets.push(pet)
        return pet
      })
    },
    async updatePet(id, changes) {
      return mutate((state) => {
        const index = state.pets.findIndex((pet) => pet.id === id)
        if (index < 0) throw new Error('未找到宠物')
        state.pets[index] = { ...state.pets[index], ...changes }
        return state.pets[index]
      })
    },
    async removePet(id) {
      mutate((state) => {
        state.pets = state.pets.filter((pet) => pet.id !== id)
        state.medicalRecords = state.medicalRecords.filter((item) => item.petId !== id)
        state.consumptions = state.consumptions.filter((item) => item.petId !== id)
        state.weights = state.weights.filter((item) => item.petId !== id)
        state.careEvents = state.careEvents.filter((item) => item.petId !== id)
        state.memories = state.memories.filter((item) => item.petId !== id)
      })
    },
    async listMedicalRecords(petId) {
      return read().medicalRecords
        .filter((record) => record.petId === petId)
        .sort((a, b) => b.visitDate.localeCompare(a.visitDate))
    },
    async addMedicalRecord(input) {
      return mutate((state) => {
        const record = { ...input, id: createId('medical') }
        state.medicalRecords.push(record)
        return record
      })
    },
    async removeMedicalRecord(id) {
      mutate((state) => {
        state.medicalRecords = state.medicalRecords.filter((record) => record.id !== id)
      })
    },
    async listConsumptions(petId, month) {
      return read().consumptions.filter((item) => item.petId === petId && item.month === month)
    },
    async addConsumption(input) {
      return mutate((state) => {
        const entry = { ...input, id: createId('consumption') }
        state.consumptions.push(entry)
        return entry
      })
    },
    async removeConsumption(id) {
      mutate((state) => {
        state.consumptions = state.consumptions.filter((item) => item.id !== id)
      })
    },
    async getMonthlySummary(petId, month) {
      const items = read().consumptions.filter((item) => item.petId === petId && item.month === month)
      return {
        totalCost: items.reduce((total, item) => total + item.cost, 0),
        entryCount: items.length,
      }
    },
    async listWeights(petId) {
      return read().weights
        .filter((item) => item.petId === petId)
        .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
    },
    async addWeight(input) {
      return mutate((state) => {
        const entry = { ...input, id: createId('weight') }
        state.weights.push(entry)
        const pet = state.pets.find((item) => item.id === input.petId)
        if (pet) pet.currentWeight = input.weightKg
        return entry
      })
    },
    async removeWeight(id) {
      mutate((state) => {
        const removed = state.weights.find((item) => item.id === id)
        state.weights = state.weights.filter((item) => item.id !== id)
        if (!removed) return
        const latest = state.weights
          .filter((item) => item.petId === removed.petId)
          .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
          .at(-1)
        const pet = state.pets.find((item) => item.id === removed.petId)
        if (pet) pet.currentWeight = latest?.weightKg ?? 0
      })
    },
    async listCareEvents(petId, date) {
      return read().careEvents
        .filter((item) => item.petId === petId && item.occurredAt.slice(0, 10) === date)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    },
    async addCareEvent(input) {
      return mutate((state) => {
        const event = { ...input, id: createId('care') }
        state.careEvents.push(event)
        return event
      })
    },
    async removeCareEvent(id) {
      mutate((state) => {
        state.careEvents = state.careEvents.filter((item) => item.id !== id)
      })
    },
    async listMemories(petId) {
      return read().memories
        .filter((item) => item.petId === petId)
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    },
    async addMemory(input) {
      return mutate((state) => {
        const memory = { ...input, id: createId('memory') }
        state.memories.push(memory)
        return memory
      })
    },
    async updateMemory(id, changes) {
      return mutate((state) => {
        const index = state.memories.findIndex((memory) => memory.id === id)
        if (index < 0) throw new Error('未找到回忆')
        state.memories[index] = { ...state.memories[index], ...changes }
        return state.memories[index]
      })
    },
    async removeMemory(id) {
      mutate((state) => {
        state.memories = state.memories.filter((memory) => memory.id !== id)
      })
    },
  }
}
