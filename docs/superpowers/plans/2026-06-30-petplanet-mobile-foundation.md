# PetPlanet Care Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add a first-class, versioned daily-care domain that works identically in local and API modes without changing any existing PetPlanet user flow.

**Architecture:** Introduce CarePlan and CareOccurrence as independent domain models. Migrate local state non-destructively from petplanet:data:v1 to petplanet:data:v2, generate a rolling seven-day occurrence window deterministically, and expose matching local, HTTP, Express, and SQLite contracts. This foundation deliberately precedes the mobile App Shell and home redesign so later UI work depends on real persisted care data rather than temporary localStorage flags.

**Tech Stack:** TypeScript 6, Vitest, React data contracts, Express 5, better-sqlite3.

---

## Scope boundary

This is the first plan in the approved App transformation. It changes data and tests only; it does not redesign the UI.

Later plans, written after this one passes, will cover:

1. mobile App Shell, five-tab navigation, quick-record sheet, and current-pet home;
2. Health/Life/Pet mobile presentation and 2D-first memory routing;
3. PWA installation/offline shell and later Capacitor readiness.

Do not add navigation, CSS, RTF, service workers, or Capacitor in this plan.

## File map

**Create**

- src/data/migrateState.ts — validates and migrates local state.
- src/data/migrateState.test.ts — preservation, rejection, and idempotence.
- src/features/care/schedule.ts — generates missing occurrences.
- src/features/care/schedule.test.ts — once/daily/weekly and duplicate coverage.

**Modify**

- src/domain/types.ts — care types and schema version.
- src/data/seed.ts — v2 state with three seed plans.
- src/data/repository.ts — local care contract and v2 storage.
- src/data/repository.test.ts — local CRUD, upsert, and cascade tests.
- src/data/httpRepository.ts — matching HTTP care contract.
- src/data/httpRepository.test.ts — request path and error tests.
- server/db.ts — care tables, seed plans, and row mappers.
- server/db.test.ts — schema and uniqueness tests.
- server/index.ts — care endpoints.

## Task 1: Add versioned care types and safe local migration

**Files:**

- Modify: src/domain/types.ts
- Modify: src/data/seed.ts
- Create: src/data/migrateState.ts
- Create: src/data/migrateState.test.ts
- Modify: src/data/repository.ts

- [ ] **Step 1: Write failing migration tests**

Create src/data/migrateState.test.ts:

    import { describe, expect, it } from 'vitest'
    import { createSeedState } from './seed'
    import { migratePetDataState } from './migrateState'

    describe('migratePetDataState', () => {
      it('preserves v1 records and initializes care arrays', () => {
        const v1 = createSeedState() as unknown as Record<string, unknown>
        delete v1.schemaVersion
        delete v1.carePlans
        delete v1.careOccurrences

        const result = migratePetDataState(v1)

        expect(result.schemaVersion).toBe(2)
        expect(result.pets).toHaveLength(3)
        expect(result.medicalRecords).toHaveLength(2)
        expect(result.consumptions).toHaveLength(4)
        expect(result.weights).toHaveLength(4)
        expect(result.memories).toHaveLength(8)
        expect(result.carePlans).toEqual([])
        expect(result.careOccurrences).toEqual([])
      })

      it('is idempotent for v2 data', () => {
        const state = createSeedState()
        expect(migratePetDataState(state)).toEqual(state)
      })

      it('rejects malformed state', () => {
        expect(() => migratePetDataState({ pets: 'broken' })).toThrow(
          'PetPlanet 本地数据格式无效',
        )
      })
    })

- [ ] **Step 2: Run the test and verify it fails**

Run:

    npm test -- src/data/migrateState.test.ts

Expected: FAIL because migrateState.ts and the care fields do not exist.

- [ ] **Step 3: Add the care domain types**

Append to src/domain/types.ts:

    export type CareCategory = 'feeding' | 'walk' | 'medication' | 'grooming' | 'other'
    export type CareStatus = 'pending' | 'done' | 'snoozed' | 'skipped'

    export type CareSchedule =
      | { kind: 'once'; at: string }
      | { kind: 'daily'; time: string }
      | { kind: 'weekly'; time: string; weekdays: number[] }

    export interface CarePlan {
      id: string
      petId: string
      title: string
      category: CareCategory
      schedule: CareSchedule
      notes: string
      isActive: boolean
    }

    export type NewCarePlan = Omit<CarePlan, 'id'>

    export interface CareOccurrence {
      id: string
      planId: string
      petId: string
      dueAt: string
      status: CareStatus
      completedAt: string | null
      snoozedUntil: string | null
    }

    export type NewCareOccurrence = Omit<CareOccurrence, 'id'>

Replace PetDataState with:

    export interface PetDataState {
      schemaVersion: 2
      pets: Pet[]
      medicalRecords: MedicalRecord[]
      consumptions: ConsumptionEntry[]
      weights: WeightEntry[]
      memories: Memory[]
      carePlans: CarePlan[]
      careOccurrences: CareOccurrence[]
    }

- [ ] **Step 4: Implement validation and migration**

Create src/data/migrateState.ts:

    import type { PetDataState } from '../domain/types'

    const requiredArrays = [
      'pets',
      'medicalRecords',
      'consumptions',
      'weights',
      'memories',
    ] as const

    export function migratePetDataState(input: unknown): PetDataState {
      if (!input || typeof input !== 'object') {
        throw new Error('PetPlanet 本地数据格式无效')
      }

      const state = input as Partial<PetDataState> & Record<string, unknown>
      if (requiredArrays.some((key) => !Array.isArray(state[key]))) {
        throw new Error('PetPlanet 本地数据格式无效')
      }

      return {
        schemaVersion: 2,
        pets: state.pets!,
        medicalRecords: state.medicalRecords!,
        consumptions: state.consumptions!,
        weights: state.weights!,
        memories: state.memories!,
        carePlans: Array.isArray(state.carePlans) ? state.carePlans : [],
        careOccurrences: Array.isArray(state.careOccurrences) ? state.careOccurrences : [],
      }
    }

- [ ] **Step 5: Update seed state**

Add schemaVersion: 2 as the first property returned by createSeedState. Add these properties after memories:

    carePlans: [
      {
        id: 'care-breakfast',
        petId: 'pet-doubao',
        title: '早餐',
        category: 'feeding',
        schedule: { kind: 'daily', time: '08:00' },
        notes: '',
        isActive: true,
      },
      {
        id: 'care-walk',
        petId: 'pet-doubao',
        title: '晚间散步',
        category: 'walk',
        schedule: { kind: 'daily', time: '18:30' },
        notes: '',
        isActive: true,
      },
      {
        id: 'care-joint',
        petId: 'pet-doubao',
        title: '关节营养',
        category: 'medication',
        schedule: { kind: 'daily', time: '21:00' },
        notes: '',
        isActive: true,
      },
    ],
    careOccurrences: [],

- [ ] **Step 6: Switch local reads to v2 without deleting v1**

In src/data/repository.ts import migratePetDataState and replace the key declaration:

    import { migratePetDataState } from './migrateState'

    const LEGACY_STORAGE_KEY = 'petplanet:data:v1'
    const STORAGE_KEY = 'petplanet:data:v2'

Replace read:

    const read = (): PetDataState => {
      const current = storage.getItem(STORAGE_KEY)
      if (current) return migratePetDataState(JSON.parse(current))

      const legacy = storage.getItem(LEGACY_STORAGE_KEY)
      const state = legacy
        ? migratePetDataState(JSON.parse(legacy))
        : migratePetDataState(JSON.parse(JSON.stringify(initialState)))

      storage.setItem(STORAGE_KEY, JSON.stringify(state))
      return state
    }

Keep write targeting only STORAGE_KEY. Do not remove or overwrite LEGACY_STORAGE_KEY.

- [ ] **Step 7: Run migration and existing repository tests**

Run:

    npm test -- src/data/migrateState.test.ts src/data/repository.test.ts

Expected: PASS.

- [ ] **Step 8: Commit**

    git add src/domain/types.ts src/data/seed.ts src/data/migrateState.ts src/data/migrateState.test.ts src/data/repository.ts
    git commit -m "feat: add versioned care data model"

## Task 2: Generate occurrences and implement the local repository contract

**Files:**

- Create: src/features/care/schedule.ts
- Create: src/features/care/schedule.test.ts
- Modify: src/data/repository.ts
- Modify: src/data/repository.test.ts

- [ ] **Step 1: Write failing schedule tests**

Create src/features/care/schedule.test.ts:

    import { describe, expect, it } from 'vitest'
    import type { CarePlan } from '../../domain/types'
    import { generateCareOccurrences } from './schedule'

    const common = {
      petId: 'pet-1',
      category: 'feeding' as const,
      notes: '',
      isActive: true,
    }

    describe('generateCareOccurrences', () => {
      it('generates once, daily, and weekly plans inside the range', () => {
        const plans: CarePlan[] = [
          {
            ...common,
            id: 'once',
            title: '复诊准备',
            schedule: { kind: 'once', at: new Date(2026, 5, 30, 9, 0).toISOString() },
          },
          {
            ...common,
            id: 'daily',
            title: '早餐',
            schedule: { kind: 'daily', time: '08:00' },
          },
          {
            ...common,
            id: 'weekly',
            title: '梳毛',
            schedule: { kind: 'weekly', time: '20:00', weekdays: [1, 5] },
          },
        ]

        const result = generateCareOccurrences(
          plans,
          [],
          new Date(2026, 5, 29),
          new Date(2026, 6, 5, 23, 59, 59),
        )

        expect(result.filter((item) => item.planId === 'once')).toHaveLength(1)
        expect(result.filter((item) => item.planId === 'daily')).toHaveLength(7)
        expect(result.filter((item) => item.planId === 'weekly')).toHaveLength(2)
      })

      it('does not recreate an existing plan and dueAt pair', () => {
        const plan: CarePlan = {
          ...common,
          id: 'daily',
          title: '早餐',
          schedule: { kind: 'daily', time: '08:00' },
        }
        const dueAt = new Date(2026, 5, 30, 8, 0).toISOString()

        const result = generateCareOccurrences(
          [plan],
          [{
            id: 'existing',
            planId: plan.id,
            petId: plan.petId,
            dueAt,
            status: 'done',
            completedAt: dueAt,
            snoozedUntil: null,
          }],
          new Date(2026, 5, 30),
          new Date(2026, 5, 30, 23, 59, 59),
        )

        expect(result).toEqual([])
      })

      it('ignores inactive plans', () => {
        const plan: CarePlan = {
          ...common,
          id: 'inactive',
          title: '停用任务',
          isActive: false,
          schedule: { kind: 'daily', time: '08:00' },
        }
        expect(generateCareOccurrences(
          [plan],
          [],
          new Date(2026, 5, 30),
          new Date(2026, 5, 30, 23, 59, 59),
        )).toEqual([])
      })
    })

- [ ] **Step 2: Run the schedule test and verify it fails**

Run:

    npm test -- src/features/care/schedule.test.ts

Expected: FAIL because schedule.ts does not exist.

- [ ] **Step 3: Implement deterministic generation**

Create src/features/care/schedule.ts:

    import type {
      CareOccurrence,
      CarePlan,
      NewCareOccurrence,
    } from '../../domain/types'

    const withLocalTime = (day: Date, time: string) => {
      const [hours, minutes] = time.split(':').map(Number)
      return new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        hours,
        minutes,
      )
    }

    export function generateCareOccurrences(
      plans: CarePlan[],
      existing: CareOccurrence[],
      from: Date,
      to: Date,
    ): NewCareOccurrence[] {
      const existingKeys = new Set(
        existing.map((item) => item.planId + '|' + item.dueAt),
      )
      const created: NewCareOccurrence[] = []

      const add = (plan: CarePlan, due: Date) => {
        if (due < from || due > to) return
        const dueAt = due.toISOString()
        const key = plan.id + '|' + dueAt
        if (existingKeys.has(key)) return
        existingKeys.add(key)
        created.push({
          planId: plan.id,
          petId: plan.petId,
          dueAt,
          status: 'pending',
          completedAt: null,
          snoozedUntil: null,
        })
      }

      for (const plan of plans.filter((item) => item.isActive)) {
        if (plan.schedule.kind === 'once') {
          add(plan, new Date(plan.schedule.at))
          continue
        }

        const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate())
        const last = new Date(to.getFullYear(), to.getMonth(), to.getDate())
        while (cursor <= last) {
          if (
            plan.schedule.kind === 'daily'
            || plan.schedule.weekdays.includes(cursor.getDay())
          ) {
            add(plan, withLocalTime(cursor, plan.schedule.time))
          }
          cursor.setDate(cursor.getDate() + 1)
        }
      }

      return created.sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    }

- [ ] **Step 4: Extend PetRepository**

Import CarePlan, CareOccurrence, NewCarePlan, and NewCareOccurrence. Add:

    listCarePlans(petId: string): Promise<CarePlan[]>
    addCarePlan(plan: NewCarePlan): Promise<CarePlan>
    updateCarePlan(
      id: string,
      changes: Partial<Omit<CarePlan, 'id' | 'petId'>>,
    ): Promise<CarePlan>
    listCareOccurrences(
      petId: string,
      from: string,
      to: string,
    ): Promise<CareOccurrence[]>
    upsertCareOccurrence(input: NewCareOccurrence): Promise<CareOccurrence>
    updateCareOccurrence(
      id: string,
      changes: Partial<Pick<CareOccurrence, 'status' | 'completedAt' | 'snoozedUntil'>>,
    ): Promise<CareOccurrence>

- [ ] **Step 5: Implement the local care methods**

Add to createLocalPetRepository:

    async listCarePlans(petId) {
      return read().carePlans.filter((plan) => plan.petId === petId)
    },
    async addCarePlan(input) {
      return mutate((state) => {
        const plan = { ...input, id: createId('care-plan') }
        state.carePlans.push(plan)
        return plan
      })
    },
    async updateCarePlan(id, changes) {
      return mutate((state) => {
        const index = state.carePlans.findIndex((plan) => plan.id === id)
        if (index < 0) throw new Error('照护计划不存在')
        state.carePlans[index] = { ...state.carePlans[index], ...changes }
        return state.carePlans[index]
      })
    },
    async listCareOccurrences(petId, from, to) {
      return read().careOccurrences
        .filter((item) => item.petId === petId && item.dueAt >= from && item.dueAt <= to)
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    },
    async upsertCareOccurrence(input) {
      return mutate((state) => {
        const existing = state.careOccurrences.find(
          (item) => item.planId === input.planId && item.dueAt === input.dueAt,
        )
        if (existing) return existing
        const occurrence = { ...input, id: createId('care-occurrence') }
        state.careOccurrences.push(occurrence)
        return occurrence
      })
    },
    async updateCareOccurrence(id, changes) {
      return mutate((state) => {
        const index = state.careOccurrences.findIndex((item) => item.id === id)
        if (index < 0) throw new Error('照护记录不存在')
        state.careOccurrences[index] = {
          ...state.careOccurrences[index],
          ...changes,
        }
        return state.careOccurrences[index]
      })
    },

Inside removePet add:

    state.carePlans = state.carePlans.filter((item) => item.petId !== id)
    state.careOccurrences = state.careOccurrences.filter((item) => item.petId !== id)

- [ ] **Step 6: Write exact local repository tests**

Append to src/data/repository.test.ts:

    it('upserts one occurrence and persists status changes', async () => {
      const repository = createLocalPetRepository(storage)
      const [pet] = await repository.listPets()
      const plan = await repository.addCarePlan({
        petId: pet.id,
        title: '睡前梳毛',
        category: 'grooming',
        schedule: { kind: 'daily', time: '21:30' },
        notes: '',
        isActive: true,
      })
      const input = {
        planId: plan.id,
        petId: pet.id,
        dueAt: '2026-06-30T13:30:00.000Z',
        status: 'pending' as const,
        completedAt: null,
        snoozedUntil: null,
      }

      const first = await repository.upsertCareOccurrence(input)
      const second = await repository.upsertCareOccurrence(input)
      expect(second.id).toBe(first.id)

      await repository.updateCareOccurrence(first.id, {
        status: 'done',
        completedAt: '2026-06-30T13:31:00.000Z',
        snoozedUntil: null,
      })

      await expect(repository.listCareOccurrences(
        pet.id,
        '2026-06-30T00:00:00.000Z',
        '2026-06-30T23:59:59.999Z',
      )).resolves.toEqual([
        expect.objectContaining({ id: first.id, status: 'done' }),
      ])
    })

    it('removes care plans and occurrences with the pet', async () => {
      const repository = createLocalPetRepository(storage)
      const [pet] = await repository.listPets()
      const plan = await repository.addCarePlan({
        petId: pet.id,
        title: '早餐',
        category: 'feeding',
        schedule: { kind: 'daily', time: '08:00' },
        notes: '',
        isActive: true,
      })
      await repository.upsertCareOccurrence({
        planId: plan.id,
        petId: pet.id,
        dueAt: '2026-06-30T00:00:00.000Z',
        status: 'pending',
        completedAt: null,
        snoozedUntil: null,
      })

      await repository.removePet(pet.id)

      await expect(repository.listCarePlans(pet.id)).resolves.toEqual([])
      await expect(repository.listCareOccurrences(
        pet.id,
        '2026-06-30T00:00:00.000Z',
        '2026-06-30T23:59:59.999Z',
      )).resolves.toEqual([])
    })

- [ ] **Step 7: Run care and repository tests**

Run:

    npm test -- src/features/care/schedule.test.ts src/data/repository.test.ts

Expected: PASS.

- [ ] **Step 8: Commit**

    git add src/features/care/schedule.ts src/features/care/schedule.test.ts src/data/repository.ts src/data/repository.test.ts
    git commit -m "feat: persist daily care occurrences"

## Task 3: Add SQLite and HTTP parity

**Files:**

- Modify: server/db.ts
- Modify: server/db.test.ts
- Modify: server/index.ts
- Modify: src/data/httpRepository.ts
- Modify: src/data/httpRepository.test.ts

- [ ] **Step 1: Add a failing schema and uniqueness test**

Append this test to server/db.test.ts:

    it('creates care tables and enforces one occurrence per plan and time', () => {
      const childScript = [
        'const { db } = await import(' + JSON.stringify(dbModuleUrl) + ');',
        "const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type = 'table'\").all().map((row) => row.name);",
        "db.prepare(\"INSERT INTO pets (id, name, species) VALUES ('pet-care', 'Care', 'dog')\").run();",
        "db.prepare(\"INSERT INTO care_plans (id, pet_id, title, category, schedule_json) VALUES ('plan-1', 'pet-care', 'Breakfast', 'feeding', '{\\\"kind\\\":\\\"daily\\\",\\\"time\\\":\\\"08:00\\\"}')\").run();",
        "db.prepare(\"INSERT INTO care_occurrences (id, plan_id, pet_id, due_at, status) VALUES ('occ-1', 'plan-1', 'pet-care', '2026-06-30T00:00:00.000Z', 'pending')\").run();",
        "let duplicate = '';",
        "try { db.prepare(\"INSERT INTO care_occurrences (id, plan_id, pet_id, due_at, status) VALUES ('occ-2', 'plan-1', 'pet-care', '2026-06-30T00:00:00.000Z', 'pending')\").run(); } catch (error) { duplicate = String(error); }",
        "console.log(JSON.stringify({ tables, duplicate }));",
        'db.close();',
      ].join('\n')

      const stdout = execFileSync(
        process.execPath,
        ['--import', tsxLoader, '--input-type=module', '--eval', childScript],
        { cwd: tempDir, encoding: 'utf8' },
      )
      const result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1)!) as {
        tables: string[]
        duplicate: string
      }

      expect(result.tables).toEqual(expect.arrayContaining([
        'care_plans',
        'care_occurrences',
      ]))
      expect(result.duplicate).toContain('UNIQUE')
    })

- [ ] **Step 2: Run the database test and verify it fails**

Run:

    npm test -- server/db.test.ts

Expected: FAIL because the care tables do not exist.

- [ ] **Step 3: Create the SQLite schema**

Add to the existing db.exec block:

    CREATE TABLE IF NOT EXISTS care_plans (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('feeding','walk','medication','grooming','other')),
      schedule_json TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS care_occurrences (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
      pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      due_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','done','snoozed','skipped')),
      completed_at TEXT,
      snoozed_until TEXT,
      UNIQUE(plan_id, due_at)
    );

Add row mappers:

    export function carePlanRow(row: Record<string, unknown>) {
      return {
        id: row.id,
        petId: row.pet_id,
        title: row.title,
        category: row.category,
        schedule: JSON.parse(row.schedule_json as string),
        notes: row.notes,
        isActive: Boolean(row.is_active),
      }
    }

    export function careOccurrenceRow(row: Record<string, unknown>) {
      return {
        id: row.id,
        planId: row.plan_id,
        petId: row.pet_id,
        dueAt: row.due_at,
        status: row.status,
        completedAt: row.completed_at ?? null,
        snoozedUntil: row.snoozed_until ?? null,
      }
    }

Inside seedIfEmpty, define:

    const insertCarePlan = db.prepare(
      'INSERT INTO care_plans (id, pet_id, title, category, schedule_json, notes, is_active) VALUES (@id, @petId, @title, @category, @scheduleJson, @notes, @isActive)',
    )

Inside the seedAll transaction, after pets are inserted, add:

    const carePlans = [
      {
        id: 'care-breakfast',
        petId: 'pet-doubao',
        title: '早餐',
        category: 'feeding',
        scheduleJson: JSON.stringify({ kind: 'daily', time: '08:00' }),
        notes: '',
        isActive: 1,
      },
      {
        id: 'care-walk',
        petId: 'pet-doubao',
        title: '晚间散步',
        category: 'walk',
        scheduleJson: JSON.stringify({ kind: 'daily', time: '18:30' }),
        notes: '',
        isActive: 1,
      },
      {
        id: 'care-joint',
        petId: 'pet-doubao',
        title: '关节营养',
        category: 'medication',
        scheduleJson: JSON.stringify({ kind: 'daily', time: '21:00' }),
        notes: '',
        isActive: 1,
      },
    ]
    for (const plan of carePlans) insertCarePlan.run(plan)

Do not seed occurrences.

- [ ] **Step 4: Add all care endpoints**

Import carePlanRow and careOccurrenceRow in server/index.ts. Add:

    app.get('/api/pets/:petId/care-plans', (req, res) => {
      const rows = db.prepare(
        'SELECT * FROM care_plans WHERE pet_id = ? ORDER BY title',
      ).all(req.params.petId)
      res.json(rows.map(carePlanRow))
    })

    app.post('/api/pets/:petId/care-plans', (req, res) => {
      const id = 'care-plan-' + uuid().slice(0, 8)
      const { title, category, schedule, notes, isActive } = req.body
      db.prepare(
        'INSERT INTO care_plans (id, pet_id, title, category, schedule_json, notes, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(
        id,
        req.params.petId,
        title,
        category,
        JSON.stringify(schedule),
        notes ?? '',
        isActive === false ? 0 : 1,
      )
      const row = db.prepare('SELECT * FROM care_plans WHERE id = ?').get(id)
      res.status(201).json(carePlanRow(row as Record<string, unknown>))
    })

    app.patch('/api/care-plans/:planId', (req, res) => {
      const existing = db.prepare(
        'SELECT * FROM care_plans WHERE id = ?',
      ).get(req.params.planId) as Record<string, unknown> | undefined
      if (!existing) return res.status(404).json({ message: '照护计划不存在' })

      const title = req.body.title ?? existing.title
      const category = req.body.category ?? existing.category
      const schedule = req.body.schedule ?? JSON.parse(existing.schedule_json as string)
      const notes = req.body.notes ?? existing.notes
      const isActive = req.body.isActive ?? Boolean(existing.is_active)
      db.prepare(
        'UPDATE care_plans SET title = ?, category = ?, schedule_json = ?, notes = ?, is_active = ? WHERE id = ?',
      ).run(
        title,
        category,
        JSON.stringify(schedule),
        notes,
        isActive ? 1 : 0,
        req.params.planId,
      )
      const row = db.prepare('SELECT * FROM care_plans WHERE id = ?').get(req.params.planId)
      res.json(carePlanRow(row as Record<string, unknown>))
    })

    app.get('/api/pets/:petId/care-occurrences', (req, res) => {
      const from = String(req.query.from ?? '')
      const to = String(req.query.to ?? '')
      if (!from || !to) {
        return res.status(400).json({ message: '缺少 from 或 to 参数' })
      }
      const rows = db.prepare(
        'SELECT * FROM care_occurrences WHERE pet_id = ? AND due_at >= ? AND due_at <= ? ORDER BY due_at',
      ).all(req.params.petId, from, to)
      res.json(rows.map(careOccurrenceRow))
    })

    app.post('/api/pets/:petId/care-occurrences', (req, res) => {
      const id = 'care-occurrence-' + uuid().slice(0, 8)
      const input = req.body
      db.prepare(
        'INSERT OR IGNORE INTO care_occurrences (id, plan_id, pet_id, due_at, status, completed_at, snoozed_until) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(
        id,
        input.planId,
        req.params.petId,
        input.dueAt,
        input.status,
        input.completedAt,
        input.snoozedUntil,
      )
      const row = db.prepare(
        'SELECT * FROM care_occurrences WHERE plan_id = ? AND due_at = ?',
      ).get(input.planId, input.dueAt) as Record<string, unknown>
      res.status(row.id === id ? 201 : 200).json(careOccurrenceRow(row))
    })

    app.patch('/api/care-occurrences/:occurrenceId', (req, res) => {
      const existing = db.prepare(
        'SELECT * FROM care_occurrences WHERE id = ?',
      ).get(req.params.occurrenceId) as Record<string, unknown> | undefined
      if (!existing) return res.status(404).json({ message: '照护记录不存在' })

      const status = req.body.status ?? existing.status
      const completedAt = req.body.completedAt === undefined
        ? existing.completed_at
        : req.body.completedAt
      const snoozedUntil = req.body.snoozedUntil === undefined
        ? existing.snoozed_until
        : req.body.snoozedUntil
      db.prepare(
        'UPDATE care_occurrences SET status = ?, completed_at = ?, snoozed_until = ? WHERE id = ?',
      ).run(status, completedAt, snoozedUntil, req.params.occurrenceId)
      const row = db.prepare(
        'SELECT * FROM care_occurrences WHERE id = ?',
      ).get(req.params.occurrenceId)
      res.json(careOccurrenceRow(row as Record<string, unknown>))
    })

- [ ] **Step 5: Implement the HTTP repository methods**

Import the four care types. Add:

    async listCarePlans(petId) {
      return request<CarePlan[]>(baseUrl + '/pets/' + petId + '/care-plans')
    },
    async addCarePlan(input) {
      return request<CarePlan>(baseUrl + '/pets/' + input.petId + '/care-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    },
    async updateCarePlan(id, changes) {
      return request<CarePlan>(baseUrl + '/care-plans/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
    },
    async listCareOccurrences(petId, from, to) {
      const query = new URLSearchParams({ from, to })
      return request<CareOccurrence[]>(
        baseUrl + '/pets/' + petId + '/care-occurrences?' + query.toString(),
      )
    },
    async upsertCareOccurrence(input) {
      return request<CareOccurrence>(
        baseUrl + '/pets/' + input.petId + '/care-occurrences',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
      )
    },
    async updateCareOccurrence(id, changes) {
      return request<CareOccurrence>(baseUrl + '/care-occurrences/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
    },

- [ ] **Step 6: Add exact HTTP contract tests**

Append to src/data/httpRepository.test.ts:

    it('requests care occurrences with encoded range parameters', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response('[]', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)
      const repository = createHttpPetRepository('/api')

      await repository.listCareOccurrences(
        'pet-doubao',
        '2026-06-30T00:00:00.000Z',
        '2026-06-30T23:59:59.999Z',
      )

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pets/pet-doubao/care-occurrences?from=2026-06-30T00%3A00%3A00.000Z&to=2026-06-30T23%3A59%3A59.999Z',
        undefined,
      )
    })

    it('posts and patches care occurrences', async () => {
      const occurrence = {
        id: 'occ-1',
        planId: 'plan-1',
        petId: 'pet-doubao',
        dueAt: '2026-06-30T00:00:00.000Z',
        status: 'pending' as const,
        completedAt: null,
        snoozedUntil: null,
      }
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(occurrence), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)
      const repository = createHttpPetRepository('/api')

      await repository.upsertCareOccurrence({
        planId: occurrence.planId,
        petId: occurrence.petId,
        dueAt: occurrence.dueAt,
        status: occurrence.status,
        completedAt: null,
        snoozedUntil: null,
      })
      await repository.updateCareOccurrence('occ-1', {
        status: 'done',
        completedAt: '2026-06-30T00:01:00.000Z',
        snoozedUntil: null,
      })

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        '/api/pets/pet-doubao/care-occurrences',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/care-occurrences/occ-1',
        expect.objectContaining({ method: 'PATCH' }),
      )
    })

- [ ] **Step 7: Run server and HTTP tests**

Run:

    npm test -- server/db.test.ts src/data/httpRepository.test.ts

Expected: PASS.

- [ ] **Step 8: Commit**

    git add server/db.ts server/db.test.ts server/index.ts src/data/httpRepository.ts src/data/httpRepository.test.ts
    git commit -m "feat: add care API persistence"

## Task 4: Verify the foundation and document the new data contract

**Files:**

- Modify: README.md

- [ ] **Step 1: Run the complete automated suite**

Run:

    npm test

Expected: all existing and new tests PASS.

- [ ] **Step 2: Run the production build**

Run:

    npm run build

Expected: TypeScript and Vite exit 0.

- [ ] **Step 3: Smoke-test local and API parity**

Run the API:

    npm run server

In another terminal run:

    npm run dev

The automated repository tests verify local mode. In PowerShell, verify API mode with:

    $planBody = '{"title":"睡前梳毛","category":"grooming","schedule":{"kind":"daily","time":"21:30"},"notes":"","isActive":true}'
    $plan = Invoke-RestMethod -Method Post -Uri 'http://localhost:61414/api/pets/pet-doubao/care-plans' -ContentType 'application/json' -Body $planBody
    $occurrenceBody = @{ planId = $plan.id; dueAt = '2026-06-30T13:30:00.000Z'; status = 'pending'; completedAt = $null; snoozedUntil = $null } | ConvertTo-Json
    $first = Invoke-RestMethod -Method Post -Uri 'http://localhost:61414/api/pets/pet-doubao/care-occurrences' -ContentType 'application/json' -Body $occurrenceBody
    $second = Invoke-RestMethod -Method Post -Uri 'http://localhost:61414/api/pets/pet-doubao/care-occurrences' -ContentType 'application/json' -Body $occurrenceBody
    if ($first.id -ne $second.id) { throw 'Occurrence upsert created a duplicate' }
    $doneBody = '{"status":"done","completedAt":"2026-06-30T13:31:00.000Z","snoozedUntil":null}'
    Invoke-RestMethod -Method Patch -Uri ('http://localhost:61414/api/care-occurrences/' + $first.id) -ContentType 'application/json' -Body $doneBody
    $items = Invoke-RestMethod -Uri 'http://localhost:61414/api/pets/pet-doubao/care-occurrences?from=2026-06-30T00%3A00%3A00.000Z&to=2026-06-30T23%3A59%3A59.999Z'
    if (@($items).Count -ne 1 -or $items[0].status -ne 'done') { throw 'API care parity check failed' }

Expected: no exception; the duplicate POST returns the original id and the final list contains one done occurrence.

- [ ] **Step 4: Update README**

Add a short Data model section stating:

- local storage now uses petplanet:data:v2 and migrates v1 non-destructively;
- CarePlan stores recurring or one-time intent;
- CareOccurrence stores due time and completion history;
- local and API repositories expose the same care methods;
- this commit does not yet change visible navigation or home UI.

- [ ] **Step 5: Commit documentation**

    git add README.md
    git commit -m "docs: document care data foundation"

## Final checkpoint

Run:

    git status --short
    npm test
    npm run build

Expected:

- only intentionally untracked design-preview files remain;
- all tests pass;
- the build exits 0;
- four focused commits implement migration, local scheduling, API parity, and documentation;
- no App Shell, CSS redesign, RTF, PWA, or Capacitor changes are present.
