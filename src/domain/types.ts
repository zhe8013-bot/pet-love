export type PetSpecies = 'dog' | 'cat' | 'other'
export type MedicalStatus = 'ongoing' | 'recovered' | 'follow-up'
export type Mood = '开心' | '安心' | '调皮' | '困困' | '恢复中'

export interface Pet {
  id: string
  name: string
  species: PetSpecies
  breed: string
  birthDate: string
  ageLabel: string
  currentWeight: number
  status: string
  avatar: string
  reminder: string
  reminderDate: string
}

export interface MedicalRecord {
  id: string
  petId: string
  visitDate: string
  symptoms: string
  diagnosis: string
  treatment: string
  medication: string
  clinic: string
  cost: number
  followUpDate: string
  photos: string[]
  status: MedicalStatus
}

export type NewMedicalRecord = Omit<MedicalRecord, 'id'>

export interface ConsumptionEntry {
  id: string
  petId: string
  month: string
  category: string
  quantity: number
  unit: string
  cost: number
}

export type NewConsumptionEntry = Omit<ConsumptionEntry, 'id'>

export interface WeightEntry {
  id: string
  petId: string
  measuredAt: string
  weightKg: number
}

export type NewWeightEntry = Omit<WeightEntry, 'id'>

export type CareEventKind = 'feeding' | 'water'

export interface CareEvent {
  id: string
  petId: string
  kind: CareEventKind
  occurredAt: string
  amount: number
  unit: 'g' | 'ml'
}

export type NewCareEvent = Omit<CareEvent, 'id'>

export interface Memory {
  id: string
  petId: string
  occurredAt: string
  mood: Mood
  note: string
  photos: string[]
  isHighlight: boolean
}

export type NewMemory = Omit<Memory, 'id'>

export interface MonthlySummary {
  totalCost: number
  entryCount: number
}

export interface PetDataState {
  pets: Pet[]
  medicalRecords: MedicalRecord[]
  consumptions: ConsumptionEntry[]
  weights: WeightEntry[]
  careEvents: CareEvent[]
  memories: Memory[]
}
