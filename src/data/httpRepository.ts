import type {
  CareEvent,
  ConsumptionEntry,
  MedicalRecord,
  Memory,
  MonthlySummary,
  Pet,
  WeightEntry,
} from '../domain/types'
import type { AssetKind, PetRepository } from './repository'

async function request<T>(url: string, init?: RequestInit, notFoundAsUndefined = false): Promise<T> {
  const res = await fetch(url, init)
  if (res.status === 404 && notFoundAsUndefined) return undefined as T
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as any).message ?? `请求失败 (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function createHttpPetRepository(baseUrl: string): PetRepository {
  return {
    async uploadAssets(files: File[], petId: string, kind: AssetKind) {
      return Promise.all(files.map(async (file) => {
        const form = new FormData()
        form.append('file', file)
        form.append('petId', petId)
        form.append('kind', kind)
        const asset = await request<{ url: string }>(`${baseUrl}/assets`, {
          method: 'POST',
          body: form,
        })
        return asset.url
      }))
    },
    async listPets() {
      return request<Pet[]>(`${baseUrl}/pets`)
    },

    async getPet(id) {
      return request<Pet | undefined>(`${baseUrl}/pets/${id}`, undefined, true)
    },

    async addPet(input) {
      return request<Pet>(`${baseUrl}/pets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    },

    async updatePet(id, changes) {
      return request<Pet>(`${baseUrl}/pets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
    },

    async removePet(id) {
      await request<void>(`${baseUrl}/pets/${id}`, { method: 'DELETE' })
    },

    async listMedicalRecords(petId) {
      return request<MedicalRecord[]>(`${baseUrl}/pets/${petId}/medical-records`)
    },

    async addMedicalRecord(input) {
      return request<MedicalRecord>(`${baseUrl}/pets/${input.petId}/medical-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    },

    async removeMedicalRecord(id) {
      await request<void>(`${baseUrl}/medical-records/${id}`, { method: 'DELETE' })
    },

    async listConsumptions(petId, month) {
      return request<ConsumptionEntry[]>(
        `${baseUrl}/pets/${petId}/consumptions?month=${encodeURIComponent(month)}`,
      )
    },

    async addConsumption(input) {
      return request<ConsumptionEntry>(`${baseUrl}/pets/${input.petId}/consumptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    },

    async removeConsumption(id) {
      await request<void>(`${baseUrl}/consumptions/${id}`, { method: 'DELETE' })
    },

    async getMonthlySummary(petId, month) {
      return request<MonthlySummary>(
        `${baseUrl}/pets/${petId}/monthly-summary?month=${encodeURIComponent(month)}`,
      )
    },

    async listWeights(petId) {
      return request<WeightEntry[]>(`${baseUrl}/pets/${petId}/weights`)
    },

    async addWeight(input) {
      return request<WeightEntry>(`${baseUrl}/pets/${input.petId}/weights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    },

    async removeWeight(id) {
      await request<void>(`${baseUrl}/weights/${id}`, { method: 'DELETE' })
    },

    async listCareEvents(petId, date) {
      return request<CareEvent[]>(
        `${baseUrl}/pets/${petId}/care-events?date=${encodeURIComponent(date)}`,
      )
    },

    async addCareEvent(input) {
      return request<CareEvent>(`${baseUrl}/pets/${input.petId}/care-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    },

    async removeCareEvent(id) {
      await request<void>(`${baseUrl}/care-events/${id}`, { method: 'DELETE' })
    },

    async listMemories(petId) {
      return request<Memory[]>(`${baseUrl}/pets/${petId}/memories`)
    },

    async addMemory(input) {
      return request<Memory>(`${baseUrl}/pets/${input.petId}/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    },

    async updateMemory(id, changes) {
      return request<Memory>(`${baseUrl}/memories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
    },

    async removeMemory(id) {
      await request<void>(`${baseUrl}/memories/${id}`, { method: 'DELETE' })
    },
  }
}
