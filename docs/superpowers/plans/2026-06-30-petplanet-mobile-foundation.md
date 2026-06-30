# PetPlanet 照护数据基础实施计划

> **面向执行代理：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans，逐项实施本计划。步骤使用复选框（- [ ]）跟踪。

**目标：** 新增一套正式、可版本迁移的日常照护领域，使其在本地模式和 API 模式下行为一致，同时不改变 PetPlanet 任何现有用户流程。

**架构：** 将 CarePlan 和 CareOccurrence 作为独立领域模型。把本地状态从 petplanet:data:v1 无损迁移到 petplanet:data:v2，以确定性方式生成未来七天的滚动执行窗口，并在本地 Repository、HTTP Repository、Express 与 SQLite 中提供一致契约。本阶段刻意先于移动 App Shell 和首页重构，确保后续 UI 使用真实持久化照护数据，而不是临时 localStorage 标记。

**技术栈：** TypeScript 6、Vitest、React 数据契约、Express 5、better-sqlite3。

---

## 范围边界

这是已确认 App 转向中的第一份计划。它只修改数据层与测试，不重做 UI。

本计划通过后，再分别编写后续计划：

1. 移动 App Shell、五项导航、快速记录底部面板和当前宠物首页；
2. 健康、生活、宠物页面移动化，以及 2D 优先的回忆路由；
3. PWA 安装与离线壳，以及后续 Capacitor 准备。

本计划不得加入导航重构、CSS 重做、RTF、Service Worker 或 Capacitor。

## 文件清单

**新增**

- src/data/migrateState.ts：校验并迁移本地状态。
- src/data/migrateState.test.ts：覆盖数据保留、非法数据拒绝和幂等性。
- src/features/care/schedule.ts：生成缺失的照护执行记录。
- src/features/care/schedule.test.ts：覆盖单次、每日、每周和去重。

**修改**

- src/domain/types.ts：照护类型和状态版本。
- src/data/seed.ts：包含三条种子计划的 v2 状态。
- src/data/repository.ts：本地照护契约与 v2 存储。
- src/data/repository.test.ts：本地增删改查、upsert 和级联测试。
- src/data/httpRepository.ts：一致的 HTTP 照护契约。
- src/data/httpRepository.test.ts：请求路径与错误测试。
- server/db.ts：照护数据表、种子计划和行映射。
- server/db.test.ts：表结构与唯一约束测试。
- server/index.ts：照护 API 端点。

## 任务 1：新增版本化照护类型与安全本地迁移

**文件：**

- 修改：src/domain/types.ts
- 修改：src/data/seed.ts
- 新增：src/data/migrateState.ts
- 新增：src/data/migrateState.test.ts
- 修改：src/data/repository.ts

- [ ] **步骤 1：编写必然失败的迁移测试**

新建 src/data/migrateState.test.ts：

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

- [ ] **步骤 2：运行测试并确认失败**

运行：

    npm test -- src/data/migrateState.test.ts

预期：FAIL，因为 migrateState.ts 和照护字段尚不存在。

- [ ] **步骤 3：新增照护领域类型**

追加到 src/domain/types.ts：

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

将 PetDataState 替换为：

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

- [ ] **步骤 4：实现校验与迁移**

新建 src/data/migrateState.ts：

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

- [ ] **步骤 5：更新种子状态**

在 createSeedState 返回对象的首项加入 schemaVersion: 2，并在 memories 后加入：

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

- [ ] **步骤 6：将本地读取切换到 v2，同时保留 v1**

在 src/data/repository.ts 中导入 migratePetDataState，并替换存储键声明：

    import { migratePetDataState } from './migrateState'

    const LEGACY_STORAGE_KEY = 'petplanet:data:v1'
    const STORAGE_KEY = 'petplanet:data:v2'

替换 read：

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

write 仍只写入 STORAGE_KEY。不得删除或覆盖 LEGACY_STORAGE_KEY。

- [ ] **步骤 7：运行迁移测试与现有 Repository 测试**

运行：

    npm test -- src/data/migrateState.test.ts src/data/repository.test.ts

预期：PASS。

- [ ] **步骤 8：提交**

    git add src/domain/types.ts src/data/seed.ts src/data/migrateState.ts src/data/migrateState.test.ts src/data/repository.ts
    git commit -m "feat: add versioned care data model"

## 任务 2：生成照护执行记录并实现本地 Repository 契约

**文件：**

- 新增：src/features/care/schedule.ts
- 新增：src/features/care/schedule.test.ts
- 修改：src/data/repository.ts
- 修改：src/data/repository.test.ts

- [ ] **步骤 1：编写必然失败的调度测试**

新建 src/features/care/schedule.test.ts：

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

- [ ] **步骤 2：运行调度测试并确认失败**

运行：

    npm test -- src/features/care/schedule.test.ts

预期：FAIL，因为 schedule.ts 尚不存在。

- [ ] **步骤 3：实现确定性执行记录生成**

新建 src/features/care/schedule.ts：

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

- [ ] **步骤 4：扩展 PetRepository**

导入 CarePlan、CareOccurrence、NewCarePlan 和 NewCareOccurrence，并新增：

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

- [ ] **步骤 5：实现本地照护方法**

添加到 createLocalPetRepository：

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

在 removePet 内加入：

    state.carePlans = state.carePlans.filter((item) => item.petId !== id)
    state.careOccurrences = state.careOccurrences.filter((item) => item.petId !== id)

- [ ] **步骤 6：编写明确的本地 Repository 测试**

追加到 src/data/repository.test.ts：

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

- [ ] **步骤 7：运行照护与 Repository 测试**

运行：

    npm test -- src/features/care/schedule.test.ts src/data/repository.test.ts

预期：PASS。

- [ ] **步骤 8：提交**

    git add src/features/care/schedule.ts src/features/care/schedule.test.ts src/data/repository.ts src/data/repository.test.ts
    git commit -m "feat: persist daily care occurrences"

## 任务 3：实现 SQLite 与 HTTP 一致性

**文件：**

- 修改：server/db.ts
- 修改：server/db.test.ts
- 修改：server/index.ts
- 修改：src/data/httpRepository.ts
- 修改：src/data/httpRepository.test.ts

- [ ] **步骤 1：新增必然失败的表结构与唯一性测试**

将以下测试追加到 server/db.test.ts：

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

- [ ] **步骤 2：运行数据库测试并确认失败**

运行：

    npm test -- server/db.test.ts

预期：FAIL，因为照护数据表尚不存在。

- [ ] **步骤 3：创建 SQLite 表结构**

添加到现有 db.exec 块：

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

新增行映射函数：

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

在 seedIfEmpty 内定义：

    const insertCarePlan = db.prepare(
      'INSERT INTO care_plans (id, pet_id, title, category, schedule_json, notes, is_active) VALUES (@id, @petId, @title, @category, @scheduleJson, @notes, @isActive)',
    )

在 seedAll 事务中、插入 pets 后加入：

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

不要预置 CareOccurrence。

- [ ] **步骤 4：新增全部照护 API 端点**

在 server/index.ts 中导入 carePlanRow 和 careOccurrenceRow，并加入：

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

- [ ] **步骤 5：实现 HTTP Repository 方法**

导入对应照护类型，并加入：

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

- [ ] **步骤 6：新增明确的 HTTP 契约测试**

追加到 src/data/httpRepository.test.ts：

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

- [ ] **步骤 7：运行服务器与 HTTP 测试**

运行：

    npm test -- server/db.test.ts src/data/httpRepository.test.ts

预期：PASS。

- [ ] **步骤 8：提交**

    git add server/db.ts server/db.test.ts server/index.ts src/data/httpRepository.ts src/data/httpRepository.test.ts
    git commit -m "feat: add care API persistence"

## 任务 4：验证基础能力并记录新数据契约

**文件：**

- 修改：README.md

- [ ] **步骤 1：运行完整自动化测试**

运行：

    npm test

预期：全部现有与新增测试 PASS。

- [ ] **步骤 2：运行生产构建**

运行：

    npm run build

预期：TypeScript 与 Vite 均以状态码 0 退出。

- [ ] **步骤 3：冒烟验证本地模式与 API 模式一致性**

启动 API：

    npm run server

在另一个终端启动前端：

    npm run dev

自动化 Repository 测试负责验证本地模式。使用以下 PowerShell 命令验证 API 模式：

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

预期：没有异常；重复 POST 返回同一个 id，最终列表只有一条状态为 done 的执行记录。

- [ ] **步骤 4：更新 README**

新增简短的“数据模型”章节，说明：

- 本地存储改用 petplanet:data:v2，并无损迁移 v1；
- CarePlan 保存周期性或单次照护意图；
- CareOccurrence 保存到期时间和完成历史；
- 本地与 API Repository 暴露相同照护方法；
- 本阶段尚不修改可见导航或首页 UI。

- [ ] **步骤 5：提交文档**

    git add README.md
    git commit -m "docs: document care data foundation"

## 最终检查点

运行：

    git status --short
    npm test
    npm run build

预期：

- 只保留有意未跟踪的设计预览文件；
- 所有测试通过；
- 构建以状态码 0 退出；
- 四个聚焦提交分别实现迁移、本地调度、API 一致性和文档；
- 不包含 App Shell、CSS 重做、RTF、PWA 或 Capacitor 改动。
