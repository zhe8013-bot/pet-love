import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { v4 as uuid } from 'uuid'
import path from 'node:path'
import fs from 'node:fs'
import { db, seedIfEmpty, petRow, medicalRow, consumptionRow, weightRow, memoryRow } from './db'

const PORT = 61414
const UPLOADS_DIR = path.resolve('data/uploads')
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const app = express()
app.use(cors({ origin: 'http://localhost:61413' }))
app.use(express.json())
app.use('/api/assets/files', express.static(UPLOADS_DIR))

// ── file upload ──────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, `${uuid()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    cb(null, allowed.includes(file.mimetype))
  },
})

// ── startup ──────────────────────────────────────────────────────
seedIfEmpty()

// ══════════════════════════════════════════════════════════════════
// PETS
// ══════════════════════════════════════════════════════════════════

app.get('/api/pets', (_req, res) => {
  const rows = db.prepare('SELECT * FROM pets').all()
  res.json(rows.map(petRow))
})

app.get('/api/pets/:petId', (req, res) => {
  const row = db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.petId)
  if (!row) return res.status(404).json({ message: '宠物不存在' })
  res.json(petRow(row))
})

app.post('/api/pets', (req, res) => {
  const { name, species, breed, birthDate, ageLabel, status, avatar, reminder, reminderDate } = req.body
  const id = `pet-${uuid().slice(0, 8)}`

  db.prepare(`
    INSERT INTO pets (id, name, species, breed, birth_date, age_label, status, avatar, reminder, reminder_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, species, breed ?? '', birthDate ?? '', ageLabel ?? '', status ?? '', avatar ?? '', reminder ?? '', reminderDate ?? '')

  const row = db.prepare('SELECT * FROM pets WHERE id = ?').get(id)
  res.status(201).json(petRow(row))
})

app.patch('/api/pets/:petId', (req, res) => {
  const existing = db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.petId)
  if (!existing) return res.status(404).json({ message: '宠物不存在' })

  const fields: Record<string, string> = { ...req.body }

  // Map camelCase to snake_case
  const colMap: Record<string, string> = {
    name: 'name', species: 'species', breed: 'breed',
    birthDate: 'birth_date', ageLabel: 'age_label', status: 'status',
    avatar: 'avatar', reminder: 'reminder', reminderDate: 'reminder_date',
  }

  const setClauses: string[] = []
  const values: string[] = []

  for (const [key, col] of Object.entries(colMap)) {
    if (fields[key] !== undefined) {
      setClauses.push(`${col} = ?`)
      values.push(fields[key])
    }
  }

  if (setClauses.length === 0) {
    return res.json(petRow(existing))
  }

  values.push(req.params.petId)
  db.prepare(`UPDATE pets SET ${setClauses.join(', ')} WHERE id = ?`).run(...values)

  const row = db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.petId)
  res.json(petRow(row))
})

app.delete('/api/pets/:petId', (req, res) => {
  const existing = db.prepare('SELECT * FROM pets WHERE id = ?').get(req.params.petId)
  if (!existing) return res.status(404).json({ message: '宠物不存在' })

  // Cascade: delete uploaded files for this pet's assets
  const assets = db.prepare('SELECT url FROM assets WHERE pet_id = ?').all(req.params.petId) as { url: string }[]
  for (const a of assets) {
    const filePath = path.join(UPLOADS_DIR, path.basename(a.url))
    try { fs.unlinkSync(filePath) } catch { /* already gone */ }
  }

  // FK cascade handles the rest
  db.prepare('DELETE FROM pets WHERE id = ?').run(req.params.petId)
  res.status(204).send()
})

// ══════════════════════════════════════════════════════════════════
// MEDICAL RECORDS
// ══════════════════════════════════════════════════════════════════

app.get('/api/pets/:petId/medical-records', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM medical_records WHERE pet_id = ? ORDER BY visit_date DESC'
  ).all(req.params.petId)
  res.json(rows.map(medicalRow))
})

app.post('/api/pets/:petId/medical-records', (req, res) => {
  const { visitDate, symptoms, diagnosis, treatment, medication, clinic, cost, followUpDate, photos, status } = req.body
  const id = `medical-${uuid().slice(0, 8)}`

  const costCents = Math.round((cost ?? 0) * 100)

  const insert = db.transaction(() => {
    db.prepare(`
      INSERT INTO medical_records (id, pet_id, visit_date, symptoms, diagnosis, treatment, medication, clinic, cost_cents, follow_up_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.petId, visitDate, symptoms ?? '', diagnosis ?? '', treatment ?? '', medication ?? '', clinic ?? '', costCents, followUpDate ?? '', status ?? 'ongoing')

    if (Array.isArray(photos)) {
      const insertAsset = db.prepare('INSERT OR IGNORE INTO medical_record_assets (medical_record_id, url) VALUES (?, ?)')
      for (const url of photos) insertAsset.run(id, url)
    }
  })

  insert()
  const row = db.prepare('SELECT * FROM medical_records WHERE id = ?').get(id)
  res.status(201).json(medicalRow(row))
})

app.delete('/api/medical-records/:recordId', (req, res) => {
  const existing = db.prepare('SELECT * FROM medical_records WHERE id = ?').get(req.params.recordId)
  if (!existing) return res.status(404).json({ message: '病历不存在' })
  db.prepare('DELETE FROM medical_records WHERE id = ?').run(req.params.recordId)
  res.status(204).send()
})

// ══════════════════════════════════════════════════════════════════
// CONSUMPTIONS
// ══════════════════════════════════════════════════════════════════

app.get('/api/pets/:petId/consumptions', (req, res) => {
  const month = req.query.month as string | undefined
  let rows
  if (month) {
    rows = db.prepare(
      'SELECT * FROM consumption_entries WHERE pet_id = ? AND month = ?'
    ).all(req.params.petId, month)
  } else {
    rows = db.prepare(
      'SELECT * FROM consumption_entries WHERE pet_id = ?'
    ).all(req.params.petId)
  }
  res.json(rows.map(consumptionRow))
})

app.post('/api/pets/:petId/consumptions', (req, res) => {
  const { month, category, quantity, unit, cost } = req.body
  const id = `consumption-${uuid().slice(0, 8)}`
  const costCents = Math.round((cost ?? 0) * 100)

  db.prepare(`
    INSERT INTO consumption_entries (id, pet_id, month, category, quantity, unit, cost_cents)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.petId, month, category ?? '', quantity ?? 0, unit ?? '', costCents)

  const row = db.prepare('SELECT * FROM consumption_entries WHERE id = ?').get(id)
  res.status(201).json(consumptionRow(row))
})

app.delete('/api/consumptions/:entryId', (req, res) => {
  const existing = db.prepare('SELECT * FROM consumption_entries WHERE id = ?').get(req.params.entryId)
  if (!existing) return res.status(404).json({ message: '消耗记录不存在' })
  db.prepare('DELETE FROM consumption_entries WHERE id = ?').run(req.params.entryId)
  res.status(204).send()
})

app.get('/api/pets/:petId/monthly-summary', (req, res) => {
  const month = req.query.month as string
  if (!month) return res.status(400).json({ message: '缺少 month 参数' })

  const row = db.prepare(`
    SELECT COALESCE(SUM(cost_cents), 0) as total_cents, COUNT(*) as entry_count
    FROM consumption_entries WHERE pet_id = ? AND month = ?
  `).get(req.params.petId, month) as { total_cents: number; entry_count: number }

  res.json({
    totalCost: Math.round(row.total_cents / 100 * 100) / 100,
    entryCount: row.entry_count,
  })
})

// ══════════════════════════════════════════════════════════════════
// WEIGHTS
// ══════════════════════════════════════════════════════════════════

app.get('/api/pets/:petId/weights', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM weight_entries WHERE pet_id = ? ORDER BY measured_at ASC'
  ).all(req.params.petId)
  res.json(rows.map(weightRow))
})

app.post('/api/pets/:petId/weights', (req, res) => {
  const { measuredAt, weightKg } = req.body
  const id = `weight-${uuid().slice(0, 8)}`

  db.prepare(`
    INSERT INTO weight_entries (id, pet_id, measured_at, weight_kg)
    VALUES (?, ?, ?, ?)
  `).run(id, req.params.petId, measuredAt, weightKg)

  const row = db.prepare('SELECT * FROM weight_entries WHERE id = ?').get(id)
  res.status(201).json(weightRow(row))
})

app.delete('/api/weights/:entryId', (req, res) => {
  const existing = db.prepare('SELECT * FROM weight_entries WHERE id = ?').get(req.params.entryId)
  if (!existing) return res.status(404).json({ message: '体重记录不存在' })
  db.prepare('DELETE FROM weight_entries WHERE id = ?').run(req.params.entryId)
  res.status(204).send()
})

// ══════════════════════════════════════════════════════════════════
// MEMORIES
// ══════════════════════════════════════════════════════════════════

app.get('/api/pets/:petId/memories', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM memories WHERE pet_id = ? ORDER BY occurred_at ASC'
  ).all(req.params.petId)
  res.json(rows.map(memoryRow))
})

app.post('/api/pets/:petId/memories', (req, res) => {
  const { occurredAt, mood, note, photos, isHighlight } = req.body
  const id = `memory-${uuid().slice(0, 8)}`

  const insert = db.transaction(() => {
    db.prepare(`
      INSERT INTO memories (id, pet_id, occurred_at, mood, note, is_highlight)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.params.petId, occurredAt, mood ?? '开心', note ?? '', isHighlight ? 1 : 0)

    if (Array.isArray(photos)) {
      const insertAsset = db.prepare('INSERT OR IGNORE INTO memory_assets (memory_id, url) VALUES (?, ?)')
      for (const url of photos) insertAsset.run(id, url)
    }
  })

  insert()
  const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(id)
  res.status(201).json(memoryRow(row))
})

app.patch('/api/memories/:memoryId', (req, res) => {
  const existing = db.prepare('SELECT * FROM memories WHERE id = ?').get(req.params.memoryId)
  if (!existing) return res.status(404).json({ message: '回忆不存在' })

  const fields: Record<string, unknown> = { ...req.body }

  const colMap: Record<string, string> = {
    occurredAt: 'occurred_at', mood: 'mood', note: 'note', isHighlight: 'is_highlight',
  }

  const setClauses: string[] = []
  const values: unknown[] = []

  for (const [key, col] of Object.entries(colMap)) {
    if (fields[key] !== undefined) {
      setClauses.push(`${col} = ?`)
      values.push(col === 'is_highlight' ? (fields[key] ? 1 : 0) : fields[key])
    }
  }

  if (fields.photos !== undefined) {
    // Replace photo associations
    db.prepare('DELETE FROM memory_assets WHERE memory_id = ?').run(req.params.memoryId)
    if (Array.isArray(fields.photos)) {
      const insertAsset = db.prepare('INSERT OR IGNORE INTO memory_assets (memory_id, url) VALUES (?, ?)')
      for (const url of fields.photos as string[]) insertAsset.run(req.params.memoryId, url)
    }
  }

  if (setClauses.length > 0) {
    values.push(req.params.memoryId)
    db.prepare(`UPDATE memories SET ${setClauses.join(', ')} WHERE id = ?`).run(...values)
  }

  const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(req.params.memoryId)
  res.json(memoryRow(row))
})

app.delete('/api/memories/:memoryId', (req, res) => {
  const existing = db.prepare('SELECT * FROM memories WHERE id = ?').get(req.params.memoryId)
  if (!existing) return res.status(404).json({ message: '回忆不存在' })
  db.prepare('DELETE FROM memories WHERE id = ?').run(req.params.memoryId)
  res.status(204).send()
})

// ══════════════════════════════════════════════════════════════════
// ASSETS
// ══════════════════════════════════════════════════════════════════

app.post('/api/assets', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '未提供文件' })

  const { petId, kind } = req.body
  if (!petId || !kind) return res.status(400).json({ message: '缺少 petId 或 kind' })

  const id = `asset-${uuid().slice(0, 8)}`
  const url = `/api/assets/files/${req.file.filename}`

  db.prepare(`
    INSERT INTO assets (id, pet_id, kind, url, mime_type, size_bytes, file_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, petId, kind, url, req.file.mimetype, req.file.size, req.file.originalname)

  res.status(201).json({ id, url, mimeType: req.file.mimetype, sizeBytes: req.file.size })
})

// ── start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] PetPlanet API on http://localhost:${PORT}`)
})
