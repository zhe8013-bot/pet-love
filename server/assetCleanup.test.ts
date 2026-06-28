// @vitest-environment node

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const serverEntry = path.join(repoRoot, 'server/index.ts')
const tsxLoader = import.meta.resolve('tsx')
const apiBase = 'http://127.0.0.1:61414/api'

const waitForServer = async () => {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiBase}/pets`)
      if (response.ok) return
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('测试 API 未能在 5 秒内启动')
}

const expectOk = async (response: Response) => {
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`)
  return response
}

describe('record asset cleanup', () => {
  let tempDir: string
  let server: ChildProcess

  beforeAll(async () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'petplanet-assets-'))
    server = spawn(
      process.execPath,
      ['--import', tsxLoader, serverEntry],
      { cwd: tempDir, stdio: 'pipe' },
    )
    await waitForServer()
  })

  afterAll(async () => {
    if (!server.killed) {
      const exited = new Promise<void>((resolve) => server.once('exit', () => resolve()))
      server.kill()
      await exited
    }
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  })

  const upload = async (kind: 'medical' | 'memory', name: string) => {
    const form = new FormData()
    form.append('file', new Blob([`image-${name}`], { type: 'image/jpeg' }), name)
    form.append('petId', 'pet-doubao')
    form.append('kind', kind)
    const response = await expectOk(await fetch(`${apiBase}/assets`, { method: 'POST', body: form }))
    return response.json() as Promise<{ url: string }>
  }

  const uploadedPath = (url: string) => path.join(tempDir, 'data/uploads', path.basename(url))

  it('removes an unreferenced medical upload after deleting its record', async () => {
    const { url } = await upload('medical', 'medical.jpg')
    const created = await expectOk(await fetch(`${apiBase}/pets/pet-doubao/medical-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitDate: '2026-06-28',
        symptoms: '轻微擦伤',
        diagnosis: '脚垫擦伤',
        treatment: '清洁护理',
        photos: [url],
      }),
    }))
    const record = await created.json() as { id: string }
    expect(existsSync(uploadedPath(url))).toBe(true)

    await expectOk(await fetch(`${apiBase}/medical-records/${record.id}`, { method: 'DELETE' }))

    expect(existsSync(uploadedPath(url))).toBe(false)
  })

  it('removes an unreferenced memory upload after deleting its record', async () => {
    const { url } = await upload('memory', 'memory.jpg')
    const created = await expectOk(await fetch(`${apiBase}/pets/pet-doubao/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        occurredAt: '2026-06-28',
        mood: '开心',
        note: '测试回忆',
        photos: [url],
        isHighlight: false,
      }),
    }))
    const memory = await created.json() as { id: string }
    expect(existsSync(uploadedPath(url))).toBe(true)

    await expectOk(await fetch(`${apiBase}/memories/${memory.id}`, { method: 'DELETE' }))

    expect(existsSync(uploadedPath(url))).toBe(false)
  })

  it('keeps a shared upload until its final memory reference is deleted', async () => {
    const { url } = await upload('memory', 'shared.jpg')
    const createMemory = async (note: string) => {
      const response = await expectOk(await fetch(`${apiBase}/pets/pet-doubao/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occurredAt: '2026-06-28',
          mood: '安心',
          note,
          photos: [url],
          isHighlight: false,
        }),
      }))
      return response.json() as Promise<{ id: string }>
    }
    const first = await createMemory('共享照片一')
    const second = await createMemory('共享照片二')

    await expectOk(await fetch(`${apiBase}/memories/${first.id}`, { method: 'DELETE' }))
    expect(existsSync(uploadedPath(url))).toBe(true)

    await expectOk(await fetch(`${apiBase}/memories/${second.id}`, { method: 'DELETE' }))
    expect(existsSync(uploadedPath(url))).toBe(false)
  })
})
