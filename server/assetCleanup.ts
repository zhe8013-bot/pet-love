import type Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

type RecordKind = 'medical' | 'memory'

interface CleanupOptions {
  database: Database.Database
  uploadsDir: string
  kind: RecordKind
  recordId: string
}

const recordConfig = {
  medical: {
    recordTable: 'medical_records',
    joinTable: 'medical_record_assets',
    joinIdColumn: 'medical_record_id',
  },
  memory: {
    recordTable: 'memories',
    joinTable: 'memory_assets',
    joinIdColumn: 'memory_id',
  },
} as const

const resolveManagedUploadPath = (uploadsDir: string, url: string) => {
  const root = path.resolve(uploadsDir)
  const fileName = path.basename(url)
  const candidate = path.resolve(root, fileName)
  const relative = path.relative(root, candidate)

  if (!fileName || !relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return undefined
  }
  return candidate
}

export function deleteRecordWithAssetCleanup({
  database,
  uploadsDir,
  kind,
  recordId,
}: CleanupOptions) {
  const config = recordConfig[kind]
  const deleteRecord = database.transaction(() => {
    const existing = database.prepare(
      `SELECT 1 FROM ${config.recordTable} WHERE id = ?`,
    ).get(recordId)
    if (!existing) return undefined

    const urls = database.prepare(
      `SELECT url FROM ${config.joinTable} WHERE ${config.joinIdColumn} = ?`,
    ).all(recordId) as { url: string }[]

    database.prepare(`DELETE FROM ${config.recordTable} WHERE id = ?`).run(recordId)

    const filesToDelete = new Set<string>()
    for (const { url } of urls) {
      const stillReferenced =
        database.prepare('SELECT 1 FROM medical_record_assets WHERE url = ? LIMIT 1').get(url) ||
        database.prepare('SELECT 1 FROM memory_assets WHERE url = ? LIMIT 1').get(url) ||
        database.prepare('SELECT 1 FROM pets WHERE avatar = ? LIMIT 1').get(url)
      if (stillReferenced) continue

      const managed = database.prepare('SELECT 1 FROM assets WHERE url = ? LIMIT 1').get(url)
      if (!managed) continue

      database.prepare('DELETE FROM assets WHERE url = ?').run(url)
      const filePath = resolveManagedUploadPath(uploadsDir, url)
      if (filePath) filesToDelete.add(filePath)
    }

    return [...filesToDelete]
  })

  const filesToDelete = deleteRecord()
  if (!filesToDelete) return false

  for (const filePath of filesToDelete) {
    try {
      fs.unlinkSync(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`[assets] failed to delete ${filePath}`, error)
      }
    }
  }
  return true
}
