# PetPlanet System Reminder Dismissal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users delete the currently displayed automatic example reminders without deleting their source records or suppressing future changed reminders.

**Architecture:** Give each automatic reminder an instance key derived from its current source values. Persist dismissed keys per pet in localStorage, filter them from Home and Daily, and reuse the existing confirmation dialog.

**Tech Stack:** React, TypeScript, localStorage, Vitest, Testing Library.

---

### Task 1: Lock the dismissal behavior with a failing test

**Files:**
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: Add the failing integration test**

Open `/daily?section=reminders`, delete the automatic “驱虫” reminder, confirm the safe-removal message, return Home, and assert the reminder remains absent after a remount.

```tsx
it('dismisses an automatic example reminder without deleting source data', async () => {
  const user = userEvent.setup()
  window.history.replaceState({}, '', '/daily?section=reminders')
  const { unmount } = render(<App />)
  const manager = await screen.findByRole('region', { name: '待办与提醒' })

  await user.click(within(manager).getByRole('button', { name: '删除驱虫提醒' }))
  const confirm = screen.getByRole('dialog', { name: '移除这条提醒？' })
  expect(within(confirm).getByText('只会从提醒列表中移除，不会删除宠物档案或病历。')).toBeInTheDocument()
  await user.click(within(confirm).getByRole('button', { name: '确认删除' }))
  expect(within(manager).queryByText('驱虫')).not.toBeInTheDocument()

  unmount()
  window.history.replaceState({}, '', '/')
  render(<App />)
  const preview = await screen.findByRole('region', { name: '今日关键提醒' })
  expect(within(preview).queryByText('驱虫')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/app/App.test.tsx -t "dismisses an automatic example"`

Expected: FAIL because automatic reminders have no delete button.

### Task 2: Add per-instance dismissal keys

**Files:**
- Modify: `src/features/reminders/reminderModel.ts`
- Modify: `src/features/home/HomePage.tsx`
- Modify: `src/features/life/LifePage.tsx`

- [ ] **Step 1: Extend automatic reminders with a dismissal key**

Add `dismissKey?: string` to `ReminderTask`. Use current source values so a changed reminder gets a new key:

```ts
dismissKey: `profile:${pet.reminder}:${pet.reminderDate}`
dismissKey: `follow-up:${followUp.id}:${followUp.followUpDate}`
dismissKey: `weight:${new Date().toISOString().slice(0, 7)}`
```

Custom todos keep `dismissKey` undefined and continue using actual deletion.

- [ ] **Step 2: Filter dismissed reminders on Home**

Load `petplanet:dismissed-reminders:<petId>` when the current pet changes and filter tasks whose `dismissKey` is stored before calculating counts and the three-item preview.

- [ ] **Step 3: Add automatic reminder deletion on Daily**

Load the same key per pet. Every automatic task receives a `删除<标题>提醒` button. On confirmation, append its `dismissKey`, clear its task status, and persist both stores without touching Repository data.

```ts
const dismissReminder = (task: ReminderTask) => {
  if (!task.dismissKey) return
  const nextDismissed = [...new Set([...dismissedReminderKeys, task.dismissKey])]
  const nextStates = { ...taskStates }
  delete nextStates[task.id]
  setDismissedReminderKeys(nextDismissed)
  setTaskStates(nextStates)
  localStorage.setItem(`petplanet:dismissed-reminders:${currentPetId}`, JSON.stringify(nextDismissed))
  localStorage.setItem(`petplanet:tasks:${currentPetId}`, JSON.stringify(nextStates))
}
```

- [ ] **Step 4: Use the safe confirmation copy**

Automatic reminder target:

```tsx
<ConfirmDialog
  title="移除这条提醒？"
  description="只会从提醒列表中移除，不会删除宠物档案或病历。"
  onConfirm={() => void removeTarget()}
/>
```

Keep the existing custom-todo confirmation copy unchanged.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- src/app/App.test.tsx -t "dismisses an automatic example"`

Expected: PASS.

- [ ] **Step 6: Run full verification**

Run: `npm test`

Expected: all test files pass.

Run: `npm run build`

Expected: TypeScript and Vite build exit 0.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 7: Commit**

```powershell
git add src/app/App.test.tsx src/features/reminders/reminderModel.ts src/features/home/HomePage.tsx src/features/life/LifePage.tsx docs/superpowers/specs/2026-07-01-petplanet-system-reminder-dismissal-design.md docs/superpowers/plans/2026-07-01-petplanet-system-reminder-dismissal.md
git commit -m "feat: dismiss automatic example reminders"
```
