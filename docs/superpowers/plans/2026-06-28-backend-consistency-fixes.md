# Backend Consistency Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make API seed data, `getPet` not-found behavior, and uploaded-file lifecycle match the `PetRepository` contract.

**Architecture:** Keep the existing Express and SQLite layout. Make database initialization injectable for in-memory tests, add a focused asset-cleanup service for transactional reference checks plus post-commit filesystem deletion, and opt `getPet` alone into 404-as-undefined behavior.

**Tech Stack:** TypeScript, Express 5, better-sqlite3, Vitest, Node.js filesystem APIs

---

### Task 1: Seed image associations

**Files:**
- Modify: `server/db.ts`
- Create: `server/db.test.ts`

- [ ] **Step 1: Write the failing seed test**

Run the database module in a child Node process whose working directory is a temporary folder. This makes the existing module-level SQLite database resolve under the temporary folder without changing production APIs. Call `seedIfEmpty()`, then assert `medical-1` returns `['/assets/memory-sunlit-nap.jpg']` and all eight memories return the same alternating photo URLs defined in `src/data/seed.ts`.

```ts
const dbModuleUrl = pathToFileURL(path.resolve('server/db.ts')).href
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
const stdout = execFileSync(process.execPath, [
  '--import', 'tsx', '--input-type=module', '--eval', childScript,
], { cwd: tempDir, encoding: 'utf8' })
const result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1)!)
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
```

- [ ] **Step 2: Run the seed test and verify RED**

Run: `npx vitest run server/db.test.ts`

Expected: FAIL because the returned photo arrays are empty.

- [ ] **Step 3: Make database initialization injectable and seed associations**

Inside the existing seed transaction, prepare and execute:

```ts
const insertMedicalAsset = target.prepare(
  'INSERT INTO medical_record_assets (medical_record_id, url) VALUES (?, ?)',
)
const insertMemoryAsset = target.prepare(
  'INSERT INTO memory_assets (memory_id, url) VALUES (?, ?)',
)

insertMedicalAsset.run('medical-1', '/assets/memory-sunlit-nap.jpg')

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
```

Do not insert these static URLs into `assets`.

- [ ] **Step 4: Run the seed test and verify GREEN**

Run: `npx vitest run server/db.test.ts`

Expected: PASS.

### Task 2: Preserve `getPet` not-found semantics

**Files:**
- Modify: `src/data/httpRepository.ts`
- Create: `src/data/httpRepository.test.ts`

- [ ] **Step 1: Write failing HTTP repository tests**

Stub `fetch` with real `Response` objects. Verify a 404 resolves to `undefined` and a 500 with `{ message: '数据库暂不可用' }` rejects with that message.

```ts
vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ message: '宠物不存在' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  }),
))
await expect(repository.getPet('missing')).resolves.toBeUndefined()
```

- [ ] **Step 2: Run the HTTP test and verify RED**

Run: `npx vitest run src/data/httpRepository.test.ts`

Expected: FAIL because the current shared request helper throws for 404.

- [ ] **Step 3: Add an explicit not-found option**

Extend the private request helper with `notFoundAsUndefined = false`. Before generic error handling, return `undefined` only when `res.status === 404 && notFoundAsUndefined`. Call it only from `getPet`:

```ts
async getPet(id) {
  return request<Pet | undefined>(`${baseUrl}/pets/${id}`, undefined, true)
}
```

- [ ] **Step 4: Run the HTTP test and verify GREEN**

Run: `npx vitest run src/data/httpRepository.test.ts`

Expected: both tests PASS.

### Task 3: Clean unreferenced managed uploads

**Files:**
- Create: `server/assetCleanup.ts`
- Create: `server/assetCleanup.test.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Write failing cleanup tests**

Run each scenario in a child Node process whose working directory is a temporary folder, so the existing module-level database and `data/uploads` directory are isolated. Use `fs.mkdtempSync` for the outer test workspace and create managed upload files inside it. Cover:

1. deleting one medical record removes its unreferenced `assets` row and physical file;
2. deleting one memory removes its unreferenced managed file;
3. when two memories share one URL, deleting the first preserves both the asset row and file, while deleting the second removes both.

Call the desired API:

```ts
const deleted = deleteRecordWithAssetCleanup({
  database: testDb,
  uploadsDir,
  kind: 'memory',
  recordId: 'memory-a',
})
expect(deleted).toBe(true)
```

- [ ] **Step 2: Run cleanup tests and verify RED**

Run: `npx vitest run server/assetCleanup.test.ts`

Expected: FAIL because `server/assetCleanup.ts` does not exist.

- [ ] **Step 3: Implement transactional reference-aware cleanup**

Create `deleteRecordWithAssetCleanup` with a fixed configuration map for medical and memory tables. It must:

```ts
const urls = database.prepare(
  `SELECT url FROM ${config.joinTable} WHERE ${config.joinIdColumn} = ?`,
).all(recordId) as { url: string }[]

database.prepare(`DELETE FROM ${config.recordTable} WHERE id = ?`).run(recordId)

const stillReferenced =
  database.prepare('SELECT 1 FROM medical_record_assets WHERE url = ? LIMIT 1').get(url) ||
  database.prepare('SELECT 1 FROM memory_assets WHERE url = ? LIMIT 1').get(url) ||
  database.prepare('SELECT 1 FROM pets WHERE avatar = ? LIMIT 1').get(url)

if (!stillReferenced) {
  const managed = database.prepare('SELECT url FROM assets WHERE url = ?').get(url)
  if (managed) {
    database.prepare('DELETE FROM assets WHERE url = ?').run(url)
    filesToDelete.add(resolveManagedUploadPath(uploadsDir, url))
  }
}
```

Run the database section in one transaction. After it commits, unlink each validated file. Ignore `ENOENT`; log other errors with `console.warn`. `resolveManagedUploadPath` must use `path.basename`, `path.resolve`, and `path.relative` to reject any path outside `uploadsDir`.

- [ ] **Step 4: Wire both delete endpoints to the service**

Replace the duplicate delete logic in `server/index.ts`:

```ts
const deleted = deleteRecordWithAssetCleanup({
  database: db,
  uploadsDir: UPLOADS_DIR,
  kind: 'medical',
  recordId: req.params.recordId,
})
if (!deleted) return res.status(404).json({ message: '病历不存在' })
res.status(204).send()
```

Use `kind: 'memory'` for the memory route.

- [ ] **Step 5: Run cleanup tests and verify GREEN**

Run: `npx vitest run server/assetCleanup.test.ts`

Expected: all cleanup tests PASS.

### Task 4: Full verification and delivery

**Files:**
- Modify: `docs/superpowers/plans/2026-06-28-backend-consistency-fixes.md` (check completed steps)

- [ ] **Step 1: Run all checks**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all tests pass, production build exits 0, and diff check is clean.

- [ ] **Step 2: Commit the fixes**

```bash
git add server src/data docs/superpowers/plans/2026-06-28-backend-consistency-fixes.md
git commit -m "fix: align backend asset lifecycle"
```

- [ ] **Step 3: Push the backend branch**

Run: `git push origin codex/petplanet-backend`

Expected: the remote branch advances without force-push.
