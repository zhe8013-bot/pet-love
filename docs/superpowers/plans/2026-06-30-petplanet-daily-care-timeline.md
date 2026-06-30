# PetPlanet 日常照护时间轴 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在生活页实现喂食、饮水、按需体重与生活照片整合的可交互日常照护时间轴。

**Architecture:** 新增 `CareEvent` 领域模型并贯通本地仓库、HTTP 仓库和 SQLite API。生活页通过独立表单组件写入喂食/饮水事件，复用现有 Weight 数据与 Memory 照片数据，保持月度消耗能力不变。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、Recharts、Express、SQLite、现有 Modal/FormField 与资源上传接口。

---

### Task 1: 新增照护事件数据能力

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/data/seed.ts`
- Modify: `src/data/repository.ts`
- Modify: `src/data/httpRepository.ts`
- Modify: `server/db.ts`
- Modify: `server/index.ts`
- Test: `src/data/repository.test.ts`
- Test: `src/data/httpRepository.test.ts`

- [ ] **Step 1: 写本地仓库失败测试**

```ts
it('stores care events by pet and date in reverse time order', async () => {
  const initialState = createSeedState()
  initialState.careEvents = []
  const repository = createLocalPetRepository(storage, initialState)
  const [dog, cat] = await repository.listPets()

  const breakfast = await repository.addCareEvent({
    petId: dog.id,
    kind: 'feeding',
    occurredAt: '2026-06-30T08:00',
    amount: 180,
    unit: 'g',
  })
  await repository.addCareEvent({
    petId: dog.id,
    kind: 'water',
    occurredAt: '2026-06-30T10:30',
    amount: 250,
    unit: 'ml',
  })
  await repository.addCareEvent({
    petId: cat.id,
    kind: 'feeding',
    occurredAt: '2026-06-30T09:00',
    amount: 60,
    unit: 'g',
  })

  expect((await repository.listCareEvents(dog.id, '2026-06-30')).map((item) => item.kind)).toEqual(['water', 'feeding'])
  await repository.removeCareEvent(breakfast.id)
  expect(await repository.listCareEvents(dog.id, '2026-06-30')).toHaveLength(1)
})
```

- [ ] **Step 2: 运行仓库测试并确认失败**

Run: `npm test -- src/data/repository.test.ts`

Expected: FAIL，`careEvents` 与仓库方法尚不存在。

- [ ] **Step 3: 添加领域类型和本地仓库实现**

```ts
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
```

`PetDataState` 增加 `careEvents: CareEvent[]`。读取旧本地数据时执行：

```ts
const parsed = JSON.parse(stored) as PetDataState
parsed.careEvents ??= []
return parsed
```

仓库接口与实现：

```ts
listCareEvents(petId: string, date: string): Promise<CareEvent[]>
addCareEvent(event: NewCareEvent): Promise<CareEvent>
removeCareEvent(id: string): Promise<void>

async listCareEvents(petId, date) {
  return read().careEvents
    .filter((item) => item.petId === petId && item.occurredAt.startsWith(date))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
},
async addCareEvent(input) {
  return mutate((state) => {
    const event = { ...input, id: createId('care') }
    state.careEvents.push(event)
    return event
  })
},
async removeCareEvent(id) {
  mutate((state) => {
    state.careEvents = state.careEvents.filter((item) => item.id !== id)
  })
},
```

- [ ] **Step 4: 添加 HTTP 仓库测试与实现**

```ts
await repository.listCareEvents('pet-doubao', '2026-06-30')
expect(fetch).toHaveBeenCalledWith('/api/pets/pet-doubao/care-events?date=2026-06-30', undefined)
```

```ts
async listCareEvents(petId, date) {
  return request<CareEvent[]>(`${baseUrl}/pets/${petId}/care-events?date=${encodeURIComponent(date)}`)
},
async addCareEvent(input) {
  return request<CareEvent>(`${baseUrl}/pets/${input.petId}/care-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
},
async removeCareEvent(id) {
  await request<void>(`${baseUrl}/care-events/${id}`, { method: 'DELETE' })
},
```

- [ ] **Step 5: 添加 SQLite 表、映射与 API**

```sql
CREATE TABLE IF NOT EXISTS care_events (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('feeding','water')),
  occurred_at TEXT NOT NULL,
  amount REAL NOT NULL,
  unit TEXT NOT NULL CHECK(unit IN ('g','ml'))
);
```

```ts
app.get('/api/pets/:petId/care-events', (req, res) => {
  const date = String(req.query.date ?? '')
  const rows = db.prepare(
    'SELECT * FROM care_events WHERE pet_id = ? AND occurred_at LIKE ? ORDER BY occurred_at DESC'
  ).all(req.params.petId, `${date}%`)
  res.json(rows.map(careEventRow))
})

app.post('/api/pets/:petId/care-events', (req, res) => {
  const { kind, occurredAt, amount, unit } = req.body
  if (!['feeding', 'water'].includes(kind) || !(Number(amount) > 0)) {
    return res.status(400).json({ message: '照护记录内容不完整' })
  }
  const id = `care-${uuid().slice(0, 8)}`
  db.prepare('INSERT INTO care_events (id, pet_id, kind, occurred_at, amount, unit) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.params.petId, kind, occurredAt, amount, unit)
  res.status(201).json(careEventRow(db.prepare('SELECT * FROM care_events WHERE id = ?').get(id)))
})
```

- [ ] **Step 6: 运行数据层测试**

Run: `npm test -- src/data/repository.test.ts src/data/httpRepository.test.ts server/db.test.ts`

Expected: PASS。

### Task 2: 构建记录表单和照片上传

**Files:**
- Create: `src/features/life/CareEventForm.tsx`
- Create: `src/features/life/LifePhotoForm.tsx`
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: 写喂食、饮水和照片表单失败测试**

```tsx
it('records feeding and water events from the daily care module', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('link', { name: '生活' }))
  await user.click(await screen.findByRole('button', { name: '记录喂食' }))
  const dialog = screen.getByRole('dialog', { name: '记录喂食' })
  await user.type(within(dialog).getByLabelText('时间'), '2026-06-30T08:00')
  await user.type(within(dialog).getByLabelText('数量（g）'), '180')
  await user.click(within(dialog).getByRole('button', { name: '保存喂食记录' }))
  expect(await screen.findByText('180 g')).toBeInTheDocument()
})
```

```tsx
it('uploads a life photo with a chosen capture time', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('link', { name: '生活' }))
  await user.click(await screen.findByRole('button', { name: '上传照片' }))
  const dialog = screen.getByRole('dialog', { name: '上传生活照片' })
  await user.type(within(dialog).getByLabelText('拍摄时间'), '2026-06-30T15:20')
  await user.type(within(dialog).getByLabelText('一句话说明'), '午后散步回来啦')
  await user.upload(within(dialog).getByLabelText('照片'), new File(['photo'], 'walk.jpg', { type: 'image/jpeg' }))
  await user.click(within(dialog).getByRole('button', { name: '保存照片' }))
  expect(await screen.findByText('午后散步回来啦')).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行 App 测试并确认失败**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL，四个快捷入口和弹窗尚不存在。

- [ ] **Step 3: 实现 CareEventForm**

```tsx
export function CareEventForm({ kind, onClose, onSaved }: {
  kind: CareEventKind
  onClose: () => void
  onSaved: () => void
}) {
  const { currentPetId, repository } = usePetData()
  const [error, setError] = useState('')
  const title = kind === 'feeding' ? '记录喂食' : '记录饮水'
  const unit = kind === 'feeding' ? 'g' : 'ml'
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const occurredAt = String(form.get('occurredAt') ?? '')
    const amount = Number(form.get('amount'))
    if (!occurredAt || !(amount > 0)) {
      setError('请填写时间和大于 0 的数量')
      return
    }
    await repository.addCareEvent({ petId: currentPetId, kind, occurredAt, amount, unit })
    onSaved()
    onClose()
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form className="record-form" onSubmit={submit}>
        <FormField label="时间" name="occurredAt" type="datetime-local" />
        <FormField label={`数量（${unit}）`} name="amount" type="number" min="0.1" step="0.1" />
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="button ghost" onClick={onClose}>取消</button>
          <button type="submit" className="button primary">保存{kind === 'feeding' ? '喂食' : '饮水'}记录</button>
        </footer>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 4: 实现 LifePhotoForm 并复用回忆数据**

```tsx
const files = (form.getAll('photos') as File[]).filter((file) => file.size > 0)
if (!capturedAt || files.length === 0) {
  setError('请选择照片和拍摄时间')
  return
}
const photos = await repository.uploadAssets(files, currentPetId, 'memory')
await repository.addMemory({
  petId: currentPetId,
  occurredAt: capturedAt,
  mood: '安心',
  note: note || '今天的生活照片',
  photos,
  isHighlight: false,
})
```

- [ ] **Step 5: 运行表单测试并确认进入下一失败点**

Run: `npm test -- src/app/App.test.tsx`

Expected: 表单可交互，测试仅因 LifePage 尚未刷新或呈现记录而失败。

### Task 3: 重组生活页为日常照护时间轴

**Files:**
- Modify: `src/features/life/LifePage.tsx`
- Modify: `src/styles/theme.css`
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: 加载照护事件和照片**

```tsx
const [careEvents, setCareEvents] = useState<CareEvent[]>([])
const [memories, setMemories] = useState<Memory[]>([])
const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))

const [nextEntries, nextWeights, nextCareEvents, nextMemories] = await Promise.all([
  repository.listConsumptions(currentPetId, month),
  repository.listWeights(currentPetId),
  repository.listCareEvents(currentPetId, selectedDate),
  repository.listMemories(currentPetId),
])
```

- [ ] **Step 2: 构建模块标题、四个入口与时间轴**

```tsx
<section className="daily-care-hub" aria-labelledby="daily-care-title">
  <header className="daily-care-heading">
    <div><p className="eyebrow">DAILY CARE</p><h2 id="daily-care-title">日常照护</h2></div>
    <div className="day-switcher">
      <button aria-label="前一天" onClick={() => changeSelectedDate(-1)}><CaretLeft size={16} /></button>
      <strong>{selectedDate === today ? '今天' : selectedDate}</strong>
      <button aria-label="后一天" onClick={() => changeSelectedDate(1)}><CaretRight size={16} /></button>
    </div>
  </header>
  <div className="care-action-grid">
    <button onClick={() => setCareComposer('feeding')}><BowlFood size={21} />记录喂食</button>
    <button onClick={() => setCareComposer('water')}><Drop size={21} />记录饮水</button>
    <button onClick={() => setWeightOpen(true)}><Scales size={21} />记录体重</button>
    <button onClick={() => setPhotoOpen(true)}><Camera size={21} />上传照片</button>
  </div>
  <div className="daily-care-layout">
    <section className="care-event-panel" aria-label={`${selectedDate}照护时间轴`}>
      {careEvents.map((event) => (
        <article className="care-event-row" key={event.id}>
          <span>{event.kind === 'feeding' ? <BowlFood size={18} /> : <Drop size={18} />}</span>
          <div><strong>{event.kind === 'feeding' ? '喂食' : '饮水'}</strong><small>{event.occurredAt.slice(11, 16)}</small></div>
          <b>{event.amount} {event.unit}</b>
          <button aria-label={`删除${event.kind === 'feeding' ? '喂食' : '饮水'}记录`} onClick={() => setDeleteTarget({ kind: 'care', item: event })}><Trash size={16} /></button>
        </article>
      ))}
      {careEvents.length === 0 && <div className="empty-state compact">这一天还没有喂食或饮水记录。</div>}
    </section>
    <section className="care-weight-panel" aria-label="体重趋势">
      <div className="chart-heading"><div><span className="panel-kicker">体重趋势</span><p>最近 {Math.min(weights.length, 8)} 次测量</p></div><strong>{latestWeight?.weightKg ?? '--'}kg</strong></div>
      <ResponsiveContainer width="100%" height={210}>
        <LineChart data={weights.slice(-8)}><Line type="monotone" dataKey="weightKg" stroke="#e88f78" strokeWidth={3} /></LineChart>
      </ResponsiveContainer>
    </section>
  </div>
  <section className="life-photo-strip" aria-label="生活照片">
    {memories.slice(-6).reverse().map((memory) => (
      <article key={memory.id}><img src={memory.photos[0]} alt="" /><span>{memory.occurredAt.slice(0, 10)}</span><strong>{memory.note}</strong></article>
    ))}
  </section>
</section>
```

- [ ] **Step 3: 删除照护事件时复用确认弹窗**

扩展 `DeleteTarget`：

```ts
type DeleteTarget =
  | { kind: 'consumption'; item: ConsumptionEntry }
  | { kind: 'weight'; item: WeightEntry }
  | { kind: 'care'; item: CareEvent }
```

确认删除时调用 `repository.removeCareEvent(deleteTarget.item.id)` 并刷新模块。

- [ ] **Step 4: 添加响应式视觉样式**

```css
.daily-care-hub { padding: 28px; border: 1px solid var(--border); border-radius: 28px; background: rgba(255,255,255,.84); box-shadow: var(--shadow); }
.care-action-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.daily-care-layout { display: grid; grid-template-columns: .8fr 1.2fr; gap: 16px; }
.life-photo-strip { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; }
@media (max-width: 720px) {
  .care-action-grid, .daily-care-layout { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .daily-care-layout { grid-template-columns: 1fr; }
  .life-photo-strip { grid-template-columns: repeat(3, minmax(0,1fr)); }
}
```

- [ ] **Step 5: 运行 App 测试**

Run: `npm test -- src/app/App.test.tsx`

Expected: PASS，原有生活记录与新照护流程均通过。

### Task 4: 视觉验收与完整验证

**Files:**
- Modify: `design-qa.md`
- Create: `design-qa/daily-care-mobile-390x844.jpg`

- [ ] **Step 1: 在可视浏览器打开生活页并检查四个入口**

Viewport: 390 × 844。

Expected: 四个入口两列排列；日常照护时间轴先于月度消耗；体重趋势不再作为孤立模块出现。

- [ ] **Step 2: 新增一条喂食记录和一张照片**

Expected: 喂食记录立即出现在时间轴；照片立即出现在照片区和回忆页。

- [ ] **Step 3: 完成设计 QA**

将生活页截图与已确认的奶油 2.5D 视觉基准放入同一对照图；修复 P0/P1/P2 问题，并在 `design-qa.md` 写入 `final result: passed`。

- [ ] **Step 4: 运行完整验证**

Run: `npm test -- --run`

Expected: 所有测试通过。

Run: `npm run build`

Expected: 构建通过；仅允许现有按需 3D chunk 大小提示。

Run: `git diff --check`

Expected: 无空白错误。
