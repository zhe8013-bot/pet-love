import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Pet } from '../domain/types'
import { createLocalPetRepository, type PetRepository } from './repository'
import { createHttpPetRepository } from './httpRepository'

interface PetDataContextValue {
  repository: PetRepository
  pets: Pet[]
  currentPet?: Pet
  currentPetId: string
  selectPet: (petId: string) => void
  refreshPets: () => Promise<void>
}

const PetDataContext = createContext<PetDataContextValue | null>(null)

const DATA_MODE = (import.meta as any).env?.VITE_DATA_MODE as string | undefined

export function PetDataProvider({ children }: { children: ReactNode }) {
  const repository = useMemo(() => {
    if (DATA_MODE === 'api') return createHttpPetRepository('/api')
    return createLocalPetRepository(localStorage)
  }, [])
  const [pets, setPets] = useState<Pet[]>([])
  const [currentPetId, setCurrentPetId] = useState('')

  const refreshPets = async () => {
    const nextPets = await repository.listPets()
    setPets(nextPets)
    setCurrentPetId((current) =>
      nextPets.some((pet) => pet.id === current) ? current : (nextPets[0]?.id ?? ''),
    )
  }

  useEffect(() => {
    void refreshPets()
  }, [])

  const value = useMemo(
    () => ({
      repository,
      pets,
      currentPet: pets.find((pet) => pet.id === currentPetId),
      currentPetId,
      selectPet: setCurrentPetId,
      refreshPets,
    }),
    [repository, pets, currentPetId],
  )

  return <PetDataContext.Provider value={value}>{children}</PetDataContext.Provider>
}

export function usePetData() {
  const value = useContext(PetDataContext)
  if (!value) throw new Error('usePetData 必须在 PetDataProvider 中使用')
  return value
}
