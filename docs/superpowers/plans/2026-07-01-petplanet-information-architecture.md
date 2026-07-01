# PetPlanet Information Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 PetPlanet 前端增量迁移到“首页、日常、健康、回忆、档案”的新版信息架构，同时保留已有记录能力和 localStorage 数据。

**Architecture:** 继续使用现有 React Router、`PetDataProvider` 和 `PetRepository`，只调整路由语义、入口顺序和页面模块职责。旧路由通过带查询参数的重定向兼容；首页使用现有数据仓库聚合总览；日常页复用现有生活页；真实 3D 从回忆主流程移除但源码保留。

**Tech Stack:** React 19、React Router 7、TypeScript、Vitest、Testing Library、Recharts、Phosphor Icons、localStorage/mock repository。

---

### Task 1: 稳定跨月测试基线

**Files:**
- Modify: `src/app/App.test.tsx`

- [ ] **Step 1: 使用现有失败用例确认日期根因**

Run:

```powershell
npm test -- src/app/App.test.tsx -t "filters and deletes monthly care records with confirmation"
```

Expected: 在系统月份为 2026-07、固定种子仍为 2026-06 时，FAIL，找不到“只看洗澡”。

- [ ] **Step 2: 为 App 测试建立当前月份种子**

在 `src/app/App.test.tsx` 导入 `createSeedState`，并在 `beforeEach` 中写入当前月份测试数据：

```tsx
import { createSeedState } from '../data/seed'

beforeEach(() => {
  localStorage.clear()
  const state = createSeedState()
  const month = new Date().toISOString().slice(0, 7)
  state.consumptions = state.consumptions.map((entry) => ({ ...entry, month }))
  localStorage.setItem('petplanet:data:v1', JSON.stringify(state))
  window.history.replaceState({}, '', '/')
})
```

- [ ] **Step 3: 验证基线恢复**

Run: `npm test -- src/app/App.test.tsx`

Expected: 16 tests pass。

- [ ] **Step 4: Commit**

```powershell
git add src/app/App.test.tsx
git commit -m "test: stabilize monthly app fixtures"
```

### Task 2: 建立新导航和兼容路由

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/features/life/LifePage.tsx`

- [ ] **Step 1: 写导航和路由失败测试**

在 `src/app/App.test.tsx` 将导航测试改为：

```tsx
it('uses the new home, daily, health, memories and profile navigation', async () => {
  render(<App />)
  const navigation = await screen.findByRole('navigation', { name: '主导航' })
  const links = within(navigation).getAllByRole('link')

  expect(links.map((link) => link.textContent)).toEqual(['首页', '日常', '健康', '回忆', '档案'])
  expect(within(navigation).getByRole('link', { name: '日常' })).toHaveAttribute('href', '/daily')
  expect(within(navigation).getByRole('link', { name: '档案' })).toHaveAttribute('href', '/profile')
})

it('keeps legacy life and pets URLs working', async () => {
  window.history.replaceState({}, '', '/life?new=weight')
  render(<App />)
  expect(await screen.findByRole('dialog', { name: '记录体重' })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/daily')
  expect(window.location.search).toBe('?new=weight')
})
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL，导航仍为“首页、健康、生活、回忆、宠物”，且 `/daily`、`/profile` 尚不存在。

- [ ] **Step 3: 实现新路由与旧地址重定向**

在 `src/app/App.tsx` 增加保留查询参数的重定向：

```tsx
function LegacyRedirect({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate replace to={`${to}${search}`} />
}

<Route path="daily" element={<LifePage />} />
<Route path="profile" element={<PetProfilePage />} />
<Route path="life" element={<LegacyRedirect to="/daily" />} />
<Route path="pets" element={<LegacyRedirect to="/profile" />} />
```

在 `src/app/AppShell.tsx` 将 `navItems` 调整为：

```tsx
const navItems = [
  { to: '/', label: '首页', icon: House },
  { to: '/daily', label: '日常', icon: ChartLineUp },
  { to: '/health', label: '健康', icon: FirstAidKit },
  { to: '/memories', label: '回忆', icon: Images },
  { to: '/profile', label: '档案', icon: IdentificationCard },
]
```

在 `src/features/life/LifePage.tsx` 把页面主标题从“生活记录”改为“日常记录”。

- [ ] **Step 4: 验证 GREEN**

Run: `npm test -- src/app/App.test.tsx`

Expected: 新导航与兼容路由测试通过。

- [ ] **Step 5: Commit**

```powershell
git add src/app/App.test.tsx src/app/App.tsx src/app/AppShell.tsx src/features/life/LifePage.tsx
git commit -m "feat: migrate primary navigation to daily and profile"
```

### Task 3: 统一全局快速记录入口

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/features/life/LifePage.tsx`

- [ ] **Step 1: 写快速记录失败测试**

```tsx
it('opens all six global quick-record destinations', async () => {
  const user = userEvent.setup()
  render(<App />)

  await user.click(await screen.findByRole('button', { name: '快速记录' }))
  const menu = screen.getByRole('menu', { name: '快速记录菜单' })
  expect(within(menu).getAllByRole('link').map((link) => link.textContent)).toEqual([
    '记录喂食', '记录饮水', '记录体重', '记录消耗', '新增病历', '添加照片 / 回忆',
  ])
  expect(within(menu).getByRole('link', { name: '记录喂食' })).toHaveAttribute('href', '/daily?new=feeding')
})
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm test -- src/app/App.test.tsx -t "opens all six global quick-record destinations"`

Expected: FAIL，当前菜单只有四项且使用旧 `/life` 地址。

- [ ] **Step 3: 实现菜单与日常查询参数**

在 `AppShell.tsx` 给菜单增加 `role="menu" aria-label="快速记录菜单"`，并按已确认顺序使用 `/daily`、`/health`、`/memories` 链接。

在 `LifePage.tsx` 扩展查询参数处理：

```tsx
if (next === 'feeding') setCareOpen('feeding')
if (next === 'water') setCareOpen('water')
if (next === 'consumption') setConsumptionOpen(true)
if (next === 'weight') setWeightOpen(true)
if (next === 'photo') setPhotoOpen(true)
```

- [ ] **Step 4: 验证 GREEN**

Run: `npm test -- src/app/App.test.tsx`

Expected: 快速记录菜单与既有表单测试全部通过。

- [ ] **Step 5: Commit**

```powershell
git add src/app/App.test.tsx src/app/AppShell.tsx src/features/life/LifePage.tsx
git commit -m "feat: expand global quick record menu"
```

### Task 4: 把首页收敛为总览页

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/features/home/HomePage.tsx`
- Modify: `src/styles/theme.css`

- [ ] **Step 1: 写首页职责失败测试**

```tsx
it('orders home as overview, reminders, quick actions, care progress, bento and memories', async () => {
  render(<App />)
  expect(await screen.findByTestId('current-pet-hero')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '今日关键提醒' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: '快捷记录' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: '今日照护进度' })).toBeInTheDocument()
  expect(screen.getByTestId('monthly-bento')).toBeInTheDocument()
  expect(screen.getByTestId('memory-preview')).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm test -- src/app/App.test.tsx -t "orders home as overview"`

Expected: FAIL，“今日关键提醒”、首页快捷记录和照护进度尚不存在。

- [ ] **Step 3: 加载当天照护数据**

在 `HomePage.tsx` 增加 `CareEvent[]` 状态，并在现有 `Promise.all` 中调用：

```tsx
repository.listCareEvents(currentPetId, localDate())
```

派生数据只包含：喂食次数、饮水次数、最近体重和当日照片数；不创建新仓库方法。

- [ ] **Step 4: 调整首页模块顺序和入口**

- 把“今日待办”标题改为“今日关键提醒”，保留添加待办、完成、稍后。
- 在提醒后增加 `aria-label="快捷记录"` 的四按钮区，链接到喂食、饮水、体重、照片。
- 增加 `aria-label="今日照护进度"` 的四项轻量 Bento。
- 将头部“记录一下”改为进入 `/daily`，避免首页直接承担完整记录表单。
- 月度 Bento 与回忆预览保持在后部。

- [ ] **Step 5: 添加现有设计系统内的样式**

在 `theme.css` 复用 `--cream`、`--peach`、`--lavender`、`--plum`、`--border`、`--shadow`，新增 `.home-quick-grid` 和 `.home-care-progress`；移动端使用两列，不引入新颜色或 emoji。

- [ ] **Step 6: 验证 GREEN**

Run: `npm test -- src/app/App.test.tsx`

Expected: 首页职责测试及原有待办、宠物切换测试通过。

- [ ] **Step 7: Commit**

```powershell
git add src/app/App.test.tsx src/features/home/HomePage.tsx src/styles/theme.css
git commit -m "feat: refocus home on daily overview"
```

### Task 5: 将回忆页收敛为 2D 成长相册

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/features/memories/MemoryPage.tsx`
- Modify: `src/styles/theme.css`

- [ ] **Step 1: 写 2D 回忆职责失败测试**

```tsx
it('keeps memories 2D and exposes only a future 3D entry', async () => {
  window.history.replaceState({}, '', '/memories')
  render(<App />)

  expect(await screen.findByRole('heading', { name: '生活回忆' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: '成长概览' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: '闪光回忆' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: '未来 3D 记忆星河' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '3D 星河' })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm test -- src/app/App.test.tsx -t "keeps memories 2D"`

Expected: FAIL，当前仍有可操作的真实 3D 模式按钮。

- [ ] **Step 3: 实现 2D 页面层级**

在 `MemoryPage.tsx`：

- 移除页面内对 `MemoryUniverse` 的动态加载和模式切换状态。
- 保留 `MemoryUniverse.tsx` 文件，不删除历史实现。
- 用现有 memories 派生 `photoCount`、`highlightCount` 和成长天数。
- 在相册前增加“成长概览”“闪光回忆”“季节时间线”。
- 在相册后增加 `aria-label="未来 3D 记忆星河"` 的 2.5D 入口卡，只显示“未来开放”，不响应真实 3D。
- 保留添加回忆、选中相册卡和已有相册网格。

- [ ] **Step 4: 添加样式并验证 GREEN**

Run: `npm test -- src/app/App.test.tsx`

Expected: 回忆页测试通过，没有 WebGL 依赖进入当前页面渲染。

- [ ] **Step 5: Commit**

```powershell
git add src/app/App.test.tsx src/features/memories/MemoryPage.tsx src/styles/theme.css
git commit -m "feat: refocus memories on the 2d growth album"
```

### Task 6: 将宠物页收敛为档案管理页

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/features/pets/PetProfilePage.tsx`
- Modify: `src/styles/theme.css`

- [ ] **Step 1: 写档案管理失败测试**

```tsx
it('adds pets from the profile page and keeps edit and delete available', async () => {
  const user = userEvent.setup()
  window.history.replaceState({}, '', '/profile')
  render(<App />)

  expect(await screen.findByRole('heading', { name: '宠物档案' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '添加宠物' }))
  expect(screen.getByRole('dialog', { name: '添加宠物' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '编辑资料' })).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm test -- src/app/App.test.tsx -t "adds pets from the profile page"`

Expected: FAIL，添加宠物当前仍由首页弹窗承担。

- [ ] **Step 3: 实现档案页添加入口**

在 `PetProfilePage.tsx`：

```tsx
const { currentPet, currentPetId, repository, selectPet } = usePetData()
const [adding, setAdding] = useState(false)

<button className="button secondary" onClick={() => setAdding(true)}>
  <Plus size={18} />添加宠物
</button>

{adding && (
  <PetForm
    onClose={() => setAdding(false)}
    onSaved={(pet) => pet && selectPet(pet.id)}
  />
)}
```

将侧栏“添加宠物”链接改为 `/profile?addPet=1`，并让档案页读取该查询参数打开表单。保留现有编辑和删除逻辑。

- [ ] **Step 4: 验证 GREEN**

Run: `npm test -- src/app/App.test.tsx`

Expected: 档案页添加、编辑及原有全局宠物切换测试通过。

- [ ] **Step 5: Commit**

```powershell
git add src/app/App.test.tsx src/app/AppShell.tsx src/features/pets/PetProfilePage.tsx src/styles/theme.css
git commit -m "feat: centralize pet management in profile"
```

### Task 7: 全量验证与可视 QA

**Files:**
- Modify: `design-qa.md`
- Modify: `design-qa/petplanet-ia-mobile.png`

- [ ] **Step 1: 运行全量自动化检查**

Run:

```powershell
npm test
npm run build
git diff --check
```

Expected: 全部测试通过；TypeScript 与 Vite 构建成功；无空白错误。

- [ ] **Step 2: 在应用内浏览器检查移动端**

使用 390×844 视口依次检查：

- 首页：总览 → 关键提醒 → 快捷记录 → 照护进度。
- 日常：四个记录入口、时间线、体重、照片、月度消耗。
- 健康：筛选和病历详情。
- 回忆：成长概览、闪光回忆、2D 相册、未来 3D 卡。
- 档案：添加与编辑宠物。
- 底部导航顺序：首页、日常、健康、回忆、档案。

- [ ] **Step 3: 记录 QA 结果**

将截图保存为 `design-qa/petplanet-ia-mobile.png`，在 `design-qa.md` 记录视口、路由、无横向溢出、控制台状态，并写入：

```text
final result: passed
```

- [ ] **Step 4: Final commit**

```powershell
git add design-qa.md design-qa/petplanet-ia-mobile.png
git commit -m "docs: verify product information architecture"
```
