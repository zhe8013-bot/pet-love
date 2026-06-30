// @vitest-environment node

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const dbModuleUrl = pathToFileURL(path.join(repoRoot, 'server/db.ts')).href
const tsxLoader = import.meta.resolve('tsx')

describe('database seed data', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'petplanet-seed-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('seeds the same medical and memory photos as the frontend mock', () => {
    const childScript = `
      const { db, seedIfEmpty, medicalRow, memoryRow } = await import(${JSON.stringify(dbModuleUrl)});
      seedIfEmpty();
      const medical = medicalRow(db.prepare('SELECT * FROM medical_records WHERE id = ?').get('medical-1'));
      const memories = db.prepare('SELECT * FROM memories ORDER BY id').all().map(memoryRow);
      console.log(JSON.stringify({
        medicalPhotos: medical.photos,
        memoryPhotos: memories.map((memory) => memory.photos[0]),
      }));
      db.close();
    `

    const stdout = execFileSync(
      process.execPath,
      ['--import', tsxLoader, '--input-type=module', '--eval', childScript],
      { cwd: tempDir, encoding: 'utf8' },
    )
    const result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1)!) as {
      medicalPhotos: string[]
      memoryPhotos: string[]
    }

    expect(result.medicalPhotos).toEqual(['/assets/memory-sunlit-nap.jpg'])
    expect(result.memoryPhotos).toEqual([
      '/assets/dog-avatar.jpg',
      '/assets/memory-sunlit-nap.jpg',
      '/assets/dog-avatar.jpg',
      '/assets/memory-sunlit-nap.jpg',
      '/assets/dog-avatar.jpg',
      '/assets/memory-sunlit-nap.jpg',
      '/assets/dog-avatar.jpg',
      '/assets/memory-sunlit-nap.jpg',
    ])
  })

  it('stores and maps daily care events', () => {
    const childScript = `
      const { db, seedIfEmpty, careEventRow } = await import(${JSON.stringify(dbModuleUrl)});
      seedIfEmpty();
      db.prepare('INSERT INTO care_events (id, pet_id, kind, occurred_at, amount, unit) VALUES (?, ?, ?, ?, ?, ?)')
        .run('care-1', 'pet-doubao', 'feeding', '2026-06-30T08:30', 180, 'g');
      const event = careEventRow(db.prepare('SELECT * FROM care_events WHERE id = ?').get('care-1'));
      console.log(JSON.stringify(event));
      db.close();
    `

    const stdout = execFileSync(
      process.execPath,
      ['--import', tsxLoader, '--input-type=module', '--eval', childScript],
      { cwd: tempDir, encoding: 'utf8' },
    )

    expect(JSON.parse(stdout.trim().split(/\r?\n/).at(-1)!)).toEqual({
      id: 'care-1',
      petId: 'pet-doubao',
      kind: 'feeding',
      occurredAt: '2026-06-30T08:30',
      amount: 180,
      unit: 'g',
    })
  })
})
