# PetPlanet 今日待办 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将首页“今日照护”改为“今日待办”，增加三字段新增弹窗，并按宠物持久化自定义待办。

**Architecture:** 新建独立 `TodoForm` 负责表单与校验；`HomePage` 负责读取、合并和保存当前宠物的自定义待办，并复用现有任务状态机制。通过 App 集成测试覆盖入口、弹窗、保存、刷新和宠物隔离。

**Tech Stack:** React 19、TypeScript、React Router、Testing Library、Vitest、localStorage、现有 Modal/FormField 组件。

---

### Task 1: 用集成测试定义新增待办体验

**Files:**
- Modify: `src/app/App.test.tsx`

- [ ] **Step 1: 写新增待办的失败测试**

```tsx
it('adds and persists a todo for the current pet', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<App />)

  expect(await screen.findByRole('heading', { name: '今日待办' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '添加待办' }))

  const dialog = screen.getByRole('dialog', { name: '添加待办' })
  await user.type(within(dialog).getByLabelText('待办事项'), '补充益生菌')
  await user.type(within(dialog).getByLabelText('描述'), '晚饭后半袋')
  await user.type(within(dialog).getByLabelText('截至时间'), '2026-07-01T18:30')
  await user.click(within(dialog).getByRole('button', { name: '保存待办' }))

  expect(await screen.findByText('补充益生菌')).toBeInTheDocument()
  expect(screen.getByText('晚饭后半袋')).toBeInTheDocument()
  unmount()
  render(<App />)
  expect(await screen.findByText('补充益生菌')).toBeInTheDocument()
})
```

- [ ] **Step 2: 写宠物隔离与校验的失败测试**

```tsx
it('validates todos and keeps them scoped to the current pet', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: '添加待办' }))
  await user.click(screen.getByRole('button', { name: '保存待办' }))
  expect(screen.getByRole('alert')).toHaveTextContent('请填写待办事项和截至时间')

  const dialog = screen.getByRole('dialog', { name: '添加待办' })
  await user.type(within(dialog).getByLabelText('待办事项'), '补充益生菌')
  await user.type(within(dialog).getByLabelText('截至时间'), '2026-07-01T18:30')
  await user.click(within(dialog).getByRole('button', { name: '保存待办' }))
  await user.selectOptions(screen.getByLabelText('当前宠物'), 'pet-mili')
  expect(screen.queryByText('补充益生菌')).not.toBeInTheDocument()
})
```

- [ ] **Step 3: 运行测试并确认正确失败**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL，原因是“今日待办”“添加待办”入口尚不存在。

### Task 2: 实现表单、持久化与页面呈现

**Files:**
- Create: `src/features/home/TodoForm.tsx`
- Modify: `src/features/home/HomePage.tsx`
- Modify: `src/styles/theme.css`
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: 创建三字段表单组件**

```tsx
import { useState, type FormEvent } from 'react'
import { FormField, TextAreaField } from '../../components/FormField'
import { Modal } from '../../components/Modal'

export interface CustomTodo {
  id: string
  title: string
  description: string
  dueAt: string
}

export function TodoForm({ onClose, onSaved }: {
  onClose: () => void
  onSaved: (todo: CustomTodo) => void
}) {
  const [error, setError] = useState('')
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    const description = String(form.get('description') ?? '').trim()
    const dueAt = String(form.get('dueAt') ?? '')
    if (!title || !dueAt) {
      setError('请填写待办事项和截至时间')
      return
    }
    onSaved({ id: `todo-${Date.now()}`, title, description, dueAt })
    onClose()
  }
  return (
    <Modal title="添加待办" onClose={onClose}>
      <form className="record-form" onSubmit={submit}>
        <FormField label="待办事项" name="title" placeholder="例如：补充益生菌" required />
        <TextAreaField label="描述" name="description" placeholder="补充一些照顾细节" />
        <FormField label="截至时间" name="dueAt" type="datetime-local" required />
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="button ghost" onClick={onClose}>取消</button>
          <button className="button primary" type="submit">保存待办</button>
        </footer>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: 在 HomePage 合并并保存当前宠物待办**

```tsx
const [customTodos, setCustomTodos] = useState<CustomTodo[]>([])
const [todoFormOpen, setTodoFormOpen] = useState(false)

useEffect(() => {
  const stored = localStorage.getItem(`petplanet:custom-todos:${currentPetId}`)
  setCustomTodos(stored ? JSON.parse(stored) as CustomTodo[] : [])
}, [currentPetId])

const saveTodo = (todo: CustomTodo) => {
  const next = [...customTodos, todo].sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  setCustomTodos(next)
  localStorage.setItem(`petplanet:custom-todos:${currentPetId}`, JSON.stringify(next))
}

const formatTodoDue = (dueAt: string) => {
  const due = new Date(dueAt)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const days = Math.round((startOfDueDay.getTime() - startOfToday.getTime()) / 86400000)
  const time = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(due)
  if (days === 0) return `今天 ${time}`
  if (days === 1) return `明天 ${time}`
  if (days > 1) return `${days}天后`
  return '已到期'
}
```

将主卡和模块标题的“今日照护”改为“今日待办”；在标题右侧增加：

```tsx
<div className="todo-heading-actions">
  <span>{completedCount}/{tasks.length} 已完成</span>
  <button className="add-todo-button" onClick={() => setTodoFormOpen(true)}>
    <Plus size={15} />添加待办
  </button>
</div>
```

自定义待办转换为现有任务结构并参与完成、稍后与统计：

```tsx
const customTasks = customTodos.map((todo) => ({
  id: todo.id,
  title: todo.title,
  detail: todo.description || '为今天留下一件要完成的事',
  due: formatTodoDue(todo.dueAt),
}))
```

- [ ] **Step 3: 匹配现有视觉并保证移动端可用**

```css
.todo-heading-actions { display: flex; align-items: center; gap: 12px; }
.add-todo-button { min-height: 38px; padding: 0 13px; display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 999px; color: var(--peach-dark); background: #fff0e9; font-size: 12px; font-weight: 800; }
@media (max-width: 720px) {
  .home-section-heading { align-items: flex-start; }
  .todo-heading-actions { display: grid; justify-items: end; gap: 7px; }
}
```

- [ ] **Step 4: 运行目标测试并确认通过**

Run: `npm test -- src/app/App.test.tsx`

Expected: PASS，包含新增待办、校验、刷新持久化和宠物隔离。

- [ ] **Step 5: 在 390 × 844 可视浏览器中验证**

Expected: “添加待办”入口可见；弹窗三个字段完整；新增卡片与用户提供的事项、描述、截至时间层级一致；页面无横向溢出。

- [ ] **Step 6: 运行全量验证并提交**

Run: `npm test -- --run && npm run build && git diff --check`

Expected: 全部测试和构建通过，仅保留已知的按需 3D 大包提示。
