import type { MedicalRecord, Pet } from '../../domain/types'

export type TaskStatus = 'done' | 'later'

export interface CustomTodo {
  id: string
  title: string
  description: string
  dueAt: string
}

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
  const time = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(due)
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
  const systemTasks: ReminderTask[] = [
    {
      id: 'reminder',
      title: pet.reminder,
      due: pet.reminderDate,
      detail: `${pet.name}的日常照护提醒`,
      sortAt: systemDueTimestamp(pet.reminderDate),
      isCustom: false,
    },
    ...(followUp ? [{
      id: 'follow-up',
      title: '复诊',
      due: followUp.followUpDate,
      detail: followUp.diagnosis,
      sortAt: systemDueTimestamp(followUp.followUpDate),
      isCustom: false,
    }] : []),
    {
      id: 'weight',
      title: '月度体重',
      due: '本月结束前',
      detail: '更新一次体重，保持趋势连续',
      sortAt: systemDueTimestamp('本月结束前'),
      isCustom: false,
    },
  ]
  const customTasks: ReminderTask[] = customTodos.map((todo) => ({
    id: todo.id,
    title: todo.title,
    detail: todo.description || '为今天留下一件要完成的事',
    due: formatTodoDue(todo.dueAt),
    sortAt: new Date(todo.dueAt).getTime(),
    isCustom: true,
  }))
  return [...systemTasks, ...customTasks].sort((a, b) => a.sortAt - b.sortAt)
}
