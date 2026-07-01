# PetPlanet Reminder Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep a three-item reminder preview on Home and move all reminder creation and management into Daily without adding a page.

**Architecture:** Extract reminder sorting and task construction into a focused reminder model shared by Home and Daily. Home renders a read-only slice; Daily owns localStorage state, the existing form, status actions, and custom-todo deletion. The existing `/daily?section=reminders` URL acts as the secondary entry point.

**Tech Stack:** React 19, React Router, TypeScript, localStorage repository pattern, Vitest, Testing Library, CSS.

---

### Task 1: Shared reminder model and read-only Home preview

**Files:**
- Create: `src/features/reminders/reminderModel.ts`
- Modify: `src/features/home/HomePage.tsx`
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: Write the failing Home preview test**

Add custom reminders before rendering, then assert that Home shows only three articles, exposes an “全部提醒” link to `/daily?section=reminders`, and has no add or completion controls.

```tsx
const todos = [
  { id: 'todo-a', title: '梳毛', description: '晚饭后', dueAt: '2026-07-02T20:00' },
  { id: 'todo-b', title: '清洗饭碗', description: '换水时一起', dueAt: '2026-07-03T09:00' },
]
localStorage.setItem('petplanet:custom-todos:pet-doubao', JSON.stringify(todos))
render(<App />)
const reminderPreview = await screen.findByRole('region', { name: '今日关键提醒' })
expect(within(reminderPreview).getAllByRole('article')).toHaveLength(3)
expect(within(reminderPreview).getByRole('link', { name: '全部提醒' })).toHaveAttribute('href', '/daily?section=reminders')
expect(within(reminderPreview).queryByRole('button', { name: '添加待办' })).not.toBeInTheDocument()
expect(within(reminderPreview).queryByRole('button', { name: '完成驱虫' })).not.toBeInTheDocument()
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/app/App.test.tsx -t "keeps Home reminders read-only"`

Expected: FAIL because Home still renders every task and management buttons.

- [ ] **Step 3: Create the shared reminder model**

Export `ReminderTask`, `TaskStatus`, and `buildReminderTasks` from `src/features/reminders/reminderModel.ts`. The builder receives the current pet, medical records, and custom todos, returns system and custom tasks with `isCustom`, and sorts by `sortAt`.

```ts
import type { MedicalRecord, Pet } from '../../domain/types'
import type { CustomTodo } from './TodoForm'

export type TaskStatus = 'done' | 'later'

export interface ReminderTask {
  id: string
  title: string
  detail: string
  due: string
  sortAt: number
  isCustom: boolean
}

const dayInMilliseconds = 86400000

const systemDueTimestamp = (due: string) => {
  const now = new Date()
  const relativeDays = due.match(/^(\d+)天后$/)
  if (relativeDays) return now.getTime() + Number(relativeDays[1]) * dayInMilliseconds
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) return new Date(`${due}T23:59`).getTime()
  if (due === '本月结束前') return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59).getTime()
  return Number.MAX_SAFE_INTEGER
}

const formatTodoDue = (dueAt: string) => {
  const due = new Date(dueAt)
  if (Number.isNaN(due.getTime())) return dueAt
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate())
  const days = Math.round((dueDay - today) / dayInMilliseconds)
  const time = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(due)
  if (days < 0) return '已到期'
  if (days === 0) return `今天 ${time}`
  if (days === 1) return `明天 ${time}`
  return `${days}天后`
}

export const buildReminderTasks = (
  pet: Pet | undefined,
  medicalRecords: MedicalRecord[],
  customTodos: CustomTodo[],
): ReminderTask[] => {
  if (!pet) return []
  const followUp = medicalRecords.find((record) => record.status === 'follow-up')
  return [
    {
      id: 'reminder', title: pet.reminder, due: pet.reminderDate,
      detail: `${pet.name}的日常照护提醒`, sortAt: systemDueTimestamp(pet.reminderDate), isCustom: false,
    },
    ...(followUp ? [{
      id: 'follow-up', title: '复诊', due: followUp.followUpDate,
      detail: followUp.diagnosis, sortAt: systemDueTimestamp(followUp.followUpDate), isCustom: false,
    }] : []),
    {
      id: 'weight', title: '月度体重', due: '本月结束前',
      detail: '更新一次体重，保持趋势连续', sortAt: systemDueTimestamp('本月结束前'), isCustom: false,
    },
    ...customTodos.map((todo) => ({
      id: todo.id, title: todo.title, detail: todo.description || '为今天留下一件要完成的事',
      due: formatTodoDue(todo.dueAt), sortAt: new Date(todo.dueAt).getTime(), isCustom: true,
    })),
  ].sort((a, b) => a.sortAt - b.sortAt)
}
```

- [ ] **Step 4: Make Home use the model and render only a preview**

Remove the Home form and mutation handlers. Render `tasks.slice(0, 3)`, retain status styling, and replace the heading action with:

```tsx
<Link className="add-todo-button" to="/daily?section=reminders">
  全部提醒<ArrowRight size={15} />
</Link>
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npm test -- src/app/App.test.tsx -t "keeps Home reminders read-only"`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/features/reminders/reminderModel.ts src/features/home/HomePage.tsx src/app/App.test.tsx
git commit -m "feat: make home reminders read only"
```

### Task 2: Daily reminder management

**Files:**
- Move: `src/features/home/TodoForm.tsx` to `src/features/reminders/TodoForm.tsx`
- Modify: `src/features/life/LifePage.tsx`
- Modify: `src/styles/theme.css`
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: Write failing Daily management tests**

Navigate through “全部提醒”, assert the Daily reminder section exists, then add, complete, postpone, and delete a custom todo. Also assert that switching the current pet removes the previous pet’s custom todo.

```tsx
await user.click(await screen.findByRole('link', { name: '全部提醒' }))
const manager = await screen.findByRole('region', { name: '待办与提醒' })
expect(window.location.search).toBe('?section=reminders')
await user.click(within(manager).getByRole('button', { name: '添加待办' }))
const dialog = screen.getByRole('dialog', { name: '添加待办' })
await user.type(within(dialog).getByLabelText('待办事项'), '补充益生菌')
await user.type(within(dialog).getByLabelText('描述'), '晚饭后半袋')
await user.type(within(dialog).getByLabelText('截至时间'), '2026-07-02T18:30')
await user.click(within(dialog).getByRole('button', { name: '保存待办' }))
expect(await within(manager).findByText('补充益生菌')).toBeInTheDocument()
await user.click(within(manager).getByRole('button', { name: '完成补充益生菌' }))
expect(within(manager).getByText('补充益生菌已完成')).toBeInTheDocument()
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/app/App.test.tsx -t "manages reminders from Daily|keeps Daily reminders scoped"`

Expected: FAIL because Daily has no reminder manager.

- [ ] **Step 3: Move the existing form into the reminder feature**

Keep the current form contract and fields unchanged. Update imports to use `../reminders/TodoForm` from Home and Life consumers.

- [ ] **Step 4: Add Daily reminder state and actions**

Load `petplanet:tasks:<petId>` and `petplanet:custom-todos:<petId>` on pet change, include medical records in Daily data loading, and use `buildReminderTasks`. Add these minimal actions:

```ts
const saveTodo = (todo: CustomTodo) => {
  const next = [...customTodos, todo].sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  setCustomTodos(next)
  localStorage.setItem(`petplanet:custom-todos:${currentPetId}`, JSON.stringify(next))
}

const updateTask = (id: string, status: TaskStatus) => {
  const next = { ...taskStates, [id]: status }
  setTaskStates(next)
  localStorage.setItem(`petplanet:tasks:${currentPetId}`, JSON.stringify(next))
}

const removeTodo = (id: string) => {
  const next = customTodos.filter((todo) => todo.id !== id)
  setCustomTodos(next)
  localStorage.setItem(`petplanet:custom-todos:${currentPetId}`, JSON.stringify(next))
}
```

- [ ] **Step 5: Render the Daily manager before today’s care hub**

Use `id="reminders"`, `aria-labelledby="daily-reminders-title"`, and apply `is-targeted` when `section=reminders`. Each task keeps the existing icon/status language; only `isCustom` rows receive a delete action.

- [ ] **Step 6: Add responsive styling**

Extend the existing cream card and timeline styles with `.daily-reminders`, `.reminder-manager-list`, and `.reminder-manager-actions`. Preserve two-column-to-one-column responsiveness and existing mobile bottom navigation clearance.

- [ ] **Step 7: Run the focused tests and verify GREEN**

Run: `npm test -- src/app/App.test.tsx -t "manages reminders from Daily|keeps Daily reminders scoped"`

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/features/reminders/TodoForm.tsx src/features/home/TodoForm.tsx src/features/life/LifePage.tsx src/styles/theme.css src/app/App.test.tsx
git commit -m "feat: manage reminders from daily"
```

### Task 3: Full verification and visible browser check

**Files:**
- Modify only if verification reveals a scoped defect.

- [ ] **Step 1: Run all automated verification**

Run: `npm test`

Expected: 6 test files pass with zero failures.

Run: `npm run build`

Expected: TypeScript and Vite build exit 0.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 2: Verify in the visible in-app browser**

At `http://127.0.0.1:61413/`, confirm Home shows three read-only reminders and “全部提醒”. Click through to `/daily?section=reminders`, confirm the manager is visible and the add form keeps the existing three fields. Check the mobile layout at 390 × 844 and inspect console warnings/errors.

- [ ] **Step 3: Record the verification result**

If a defect appears, return to the task that owns that behavior, add a failing test, make the scoped correction, and repeat the full verification commands before committing.
