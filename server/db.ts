import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

const DATA_DIR = path.resolve('data')
const DB_PATH = path.join(DATA_DIR, 'petplanet.db')

fs.mkdirSync(DATA_DIR, { recursive: true })

export const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── auto-migration ──────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS pets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    species TEXT NOT NULL CHECK(species IN ('dog','cat','other')),
    breed TEXT NOT NULL DEFAULT '',
    birth_date TEXT NOT NULL DEFAULT '',
    age_label TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL DEFAULT '',
    reminder TEXT NOT NULL DEFAULT '',
    reminder_date TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS medical_records (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    visit_date TEXT NOT NULL,
    symptoms TEXT NOT NULL DEFAULT '',
    diagnosis TEXT NOT NULL DEFAULT '',
    treatment TEXT NOT NULL DEFAULT '',
    medication TEXT NOT NULL DEFAULT '',
    clinic TEXT NOT NULL DEFAULT '',
    cost_cents INTEGER NOT NULL DEFAULT 0,
    follow_up_date TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ongoing' CHECK(status IN ('ongoing','recovered','follow-up'))
  );

  CREATE TABLE IF NOT EXISTS consumption_entries (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    quantity REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '',
    cost_cents INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS weight_entries (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    measured_at TEXT NOT NULL,
    weight_kg REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS care_events (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('feeding','water')),
    occurred_at TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),
    unit TEXT NOT NULL CHECK(unit IN ('g','ml'))
  );

  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    occurred_at TEXT NOT NULL,
    mood TEXT NOT NULL DEFAULT '开心',
    note TEXT NOT NULL DEFAULT '',
    is_highlight INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('avatar','medical','memory')),
    url TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    file_name TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS medical_record_assets (
    medical_record_id TEXT NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    PRIMARY KEY (medical_record_id, url)
  );

  CREATE TABLE IF NOT EXISTS memory_assets (
    memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    PRIMARY KEY (memory_id, url)
  );
`)

// ── seed ─────────────────────────────────────────────────────────
export function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM pets').get() as { c: number }
  if (count.c > 0) return

  const insertPet = db.prepare(`
    INSERT INTO pets (id, name, species, breed, birth_date, age_label, status, avatar, reminder, reminder_date)
    VALUES (@id, @name, @species, @breed, @birthDate, @ageLabel, @status, @avatar, @reminder, @reminderDate)
  `)
  const insertMedical = db.prepare(`
    INSERT INTO medical_records (id, pet_id, visit_date, symptoms, diagnosis, treatment, medication, clinic, cost_cents, follow_up_date, status)
    VALUES (@id, @petId, @visitDate, @symptoms, @diagnosis, @treatment, @medication, @clinic, @costCents, @followUpDate, @status)
  `)
  const insertConsumption = db.prepare(`
    INSERT INTO consumption_entries (id, pet_id, month, category, quantity, unit, cost_cents)
    VALUES (@id, @petId, @month, @category, @quantity, @unit, @costCents)
  `)
  const insertWeight = db.prepare(`
    INSERT INTO weight_entries (id, pet_id, measured_at, weight_kg)
    VALUES (@id, @petId, @measuredAt, @weightKg)
  `)
  const insertMemory = db.prepare(`
    INSERT INTO memories (id, pet_id, occurred_at, mood, note, is_highlight)
    VALUES (@id, @petId, @occurredAt, @mood, @note, @isHighlight)
  `)
  const insertMedicalAsset = db.prepare(`
    INSERT INTO medical_record_assets (medical_record_id, url)
    VALUES (?, ?)
  `)
  const insertMemoryAsset = db.prepare(`
    INSERT INTO memory_assets (memory_id, url)
    VALUES (?, ?)
  `)

  const pets = [
    { id: 'pet-doubao',      name: '豆包', species: 'dog',  breed: '金毛寻回犬', birthDate: '2022-03-12', ageLabel: '4岁', status: '活泼', avatar: '/assets/dog-avatar.jpg',     reminder: '驱虫', reminderDate: '3天后' },
    { id: 'pet-mili',        name: '米粒', species: 'cat',  breed: '橘猫',       birthDate: '2024-04-20', ageLabel: '2岁', status: '贪睡', avatar: '/assets/cat-avatar.jpg',     reminder: '疫苗', reminderDate: '本月20日' },
    { id: 'pet-tangtang',    name: '糖糖', species: 'dog',  breed: '边境牧羊犬', birthDate: '2023-02-03', ageLabel: '3岁', status: '聪明', avatar: '/assets/collie-avatar.jpg',  reminder: '梳毛', reminderDate: '明天' },
  ]

  const seedAll = db.transaction(() => {
    for (const p of pets) insertPet.run(p)

    insertMedical.run({ id: 'medical-1', petId: 'pet-doubao', visitDate: '2026-06-18', symptoms: '饭后偶尔干呕，精神状态正常', diagnosis: '轻度消化不良', treatment: '清淡饮食三天，减少零食', medication: '宠物益生菌，每日一次', clinic: '暖爪动物医院', costCents: 26000, followUpDate: '2026-06-25', status: 'follow-up' })
    insertMedical.run({ id: 'medical-2', petId: 'pet-doubao', visitDate: '2026-03-08', symptoms: '年度常规体检', diagnosis: '各项指标正常', treatment: '继续保持每日运动', medication: '', clinic: '暖爪动物医院', costCents: 48000, followUpDate: '', status: 'recovered' })
    insertMedicalAsset.run('medical-1', '/assets/memory-sunlit-nap.jpg')

    insertConsumption.run({ id: 'consumption-1', petId: 'pet-doubao', month: '2026-06', category: '主粮', quantity: 6, unit: 'kg', costCents: 36000 })
    insertConsumption.run({ id: 'consumption-2', petId: 'pet-doubao', month: '2026-06', category: '零食', quantity: 4, unit: '袋', costCents: 9000 })
    insertConsumption.run({ id: 'consumption-3', petId: 'pet-doubao', month: '2026-06', category: '饮水', quantity: 42, unit: 'L', costCents: 0 })
    insertConsumption.run({ id: 'consumption-4', petId: 'pet-doubao', month: '2026-06', category: '洗澡', quantity: 2, unit: '次', costCents: 18000 })

    insertWeight.run({ id: 'weight-1', petId: 'pet-doubao', measuredAt: '2026-01-10', weightKg: 32.4 })
    insertWeight.run({ id: 'weight-2', petId: 'pet-doubao', measuredAt: '2026-03-10', weightKg: 32.1 })
    insertWeight.run({ id: 'weight-3', petId: 'pet-doubao', measuredAt: '2026-05-08', weightKg: 31.9 })
    insertWeight.run({ id: 'weight-4', petId: 'pet-doubao', measuredAt: '2026-06-20', weightKg: 31.8 })

    insertMemory.run({ id: 'memory-1', petId: 'pet-doubao', occurredAt: '2024-03-12', mood: '开心', note: '第一次来到我们家。', isHighlight: 1 })
    insertMemory.run({ id: 'memory-2', petId: 'pet-doubao', occurredAt: '2024-07-20', mood: '调皮', note: '第一次把拖鞋藏到沙发底下。', isHighlight: 0 })
    insertMemory.run({ id: 'memory-3', petId: 'pet-doubao', occurredAt: '2025-02-14', mood: '安心', note: '在窗边晒了一整个下午的太阳。', isHighlight: 0 })
    insertMemory.run({ id: 'memory-4', petId: 'pet-doubao', occurredAt: '2025-06-18', mood: '开心', note: '第一次去海边，浪花追着脚印跑。', isHighlight: 1 })
    insertMemory.run({ id: 'memory-5', petId: 'pet-doubao', occurredAt: '2025-10-02', mood: '调皮', note: '把家里的纸箱都占领了。', isHighlight: 0 })
    insertMemory.run({ id: 'memory-6', petId: 'pet-doubao', occurredAt: '2026-01-01', mood: '困困', note: '跨年钟声没能叫醒熟睡的小家伙。', isHighlight: 0 })
    insertMemory.run({ id: 'memory-7', petId: 'pet-doubao', occurredAt: '2026-04-05', mood: '开心', note: '春天的第一场长途散步。', isHighlight: 0 })
    insertMemory.run({ id: 'memory-8', petId: 'pet-doubao', occurredAt: '2026-06-22', mood: '安心', note: '午后阳光下的午睡。', isHighlight: 1 })

    const memoryPhotos = [
      '/assets/dog-avatar.jpg',
      '/assets/memory-sunlit-nap.jpg',
      '/assets/dog-avatar.jpg',
      '/assets/memory-sunlit-nap.jpg',
      '/assets/dog-avatar.jpg',
      '/assets/memory-sunlit-nap.jpg',
      '/assets/dog-avatar.jpg',
      '/assets/memory-sunlit-nap.jpg',
    ]
    memoryPhotos.forEach((url, index) => insertMemoryAsset.run(`memory-${index + 1}`, url))
  })

  seedAll()
  console.log('[db] seeded mock data')
}

// ── row → domain helpers ─────────────────────────────────────────
export function petRow(row: Record<string, unknown>) {
  const latestWeight = db.prepare(
    'SELECT weight_kg FROM weight_entries WHERE pet_id = ? ORDER BY measured_at DESC LIMIT 1'
  ).get(row.id) as { weight_kg: number } | undefined

  return {
    id: row.id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    birthDate: row.birth_date,
    ageLabel: row.age_label,
    currentWeight: latestWeight?.weight_kg ?? 0,
    status: row.status,
    avatar: row.avatar,
    reminder: row.reminder,
    reminderDate: row.reminder_date,
  }
}

export function medicalRow(r: Record<string, unknown>) {
  const photos = db.prepare(
    'SELECT url FROM medical_record_assets WHERE medical_record_id = ?'
  ).all(r.id).map((a: any) => a.url)

  return {
    id: r.id,
    petId: r.pet_id,
    visitDate: r.visit_date,
    symptoms: r.symptoms,
    diagnosis: r.diagnosis,
    treatment: r.treatment,
    medication: r.medication,
    clinic: r.clinic,
    cost: Math.round((r.cost_cents as number) / 100 * 100) / 100,
    followUpDate: r.follow_up_date,
    photos,
    status: r.status,
  }
}

export function consumptionRow(r: Record<string, unknown>) {
  return {
    id: r.id,
    petId: r.pet_id,
    month: r.month,
    category: r.category,
    quantity: r.quantity,
    unit: r.unit,
    cost: Math.round((r.cost_cents as number) / 100 * 100) / 100,
  }
}

export function weightRow(r: Record<string, unknown>) {
  return {
    id: r.id,
    petId: r.pet_id,
    measuredAt: r.measured_at,
    weightKg: r.weight_kg,
  }
}

export function careEventRow(r: Record<string, unknown>) {
  return {
    id: r.id,
    petId: r.pet_id,
    kind: r.kind,
    occurredAt: r.occurred_at,
    amount: r.amount,
    unit: r.unit,
  }
}

export function memoryRow(r: Record<string, unknown>) {
  const photos = db.prepare(
    'SELECT url FROM memory_assets WHERE memory_id = ?'
  ).all(r.id).map((a: any) => a.url)

  return {
    id: r.id,
    petId: r.pet_id,
    occurredAt: r.occurred_at,
    mood: r.mood,
    note: r.note,
    photos,
    isHighlight: Boolean(r.is_highlight),
  }
}
