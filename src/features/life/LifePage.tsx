import {
  Bell,
  BowlFood,
  Camera,
  CaretLeft,
  CaretRight,
  ChartLineUp,
  Check,
  ClockCountdown,
  Drop,
  Plus,
  Scales,
  ShoppingBagOpen,
  Trash,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { usePetData } from '../../data/PetDataProvider'
import type { CareEvent, CareEventKind, ConsumptionEntry, MedicalRecord, Memory, WeightEntry } from '../../domain/types'
import { TodoForm } from '../reminders/TodoForm'
import { buildReminderTasks, type CustomTodo, type ReminderTask, type TaskStatus } from '../reminders/reminderModel'
import { CareEventForm } from './CareEventForm'
import { ConsumptionForm } from './ConsumptionForm'
import { LifePhotoForm } from './LifePhotoForm'
import { WeightForm } from './WeightForm'

type DeleteTarget =
  | { kind: 'consumption'; item: ConsumptionEntry }
  | { kind: 'weight'; item: WeightEntry }
  | { kind: 'care'; item: CareEvent }
  | { kind: 'todo'; item: CustomTodo }
  | { kind: 'reminder'; item: ReminderTask }

const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const nowMonth = () => localDate().slice(0, 7)

const shiftDate = (value: string, offset: number) => {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + offset)
  return localDate(date)
}

const careCopy = {
  feeding: { label: '喂食', Icon: BowlFood },
  water: { label: '饮水', Icon: Drop },
}

export function LifePage() {
  const { currentPet, currentPetId, repository, refreshPets } = usePetData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [entries, setEntries] = useState<ConsumptionEntry[]>([])
  const [weights, setWeights] = useState<WeightEntry[]>([])
  const [careEvents, setCareEvents] = useState<CareEvent[]>([])
  const [memories, setMemories] = useState<Memory[]>([])
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([])
  const [taskStates, setTaskStates] = useState<Record<string, TaskStatus>>({})
  const [customTodos, setCustomTodos] = useState<CustomTodo[]>([])
  const [dismissedReminderKeys, setDismissedReminderKeys] = useState<string[]>([])
  const [consumptionOpen, setConsumptionOpen] = useState(false)
  const [weightOpen, setWeightOpen] = useState(false)
  const [careOpen, setCareOpen] = useState<CareEventKind | null>(null)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [todoFormOpen, setTodoFormOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(localDate)
  const [month, setMonth] = useState(nowMonth)
  const [category, setCategory] = useState('全部')
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadEntries = useCallback(async () => {
    if (!currentPetId) return
    setLoading(true)
    setLoadError('')
    try {
      const [nextEntries, nextWeights, nextCareEvents, nextMemories, nextMedicalRecords] = await Promise.all([
        repository.listConsumptions(currentPetId, month),
        repository.listWeights(currentPetId),
        repository.listCareEvents(currentPetId, selectedDate),
        repository.listMemories(currentPetId),
        repository.listMedicalRecords(currentPetId),
      ])
      setEntries(nextEntries)
      setWeights(nextWeights)
      setCareEvents(nextCareEvents)
      setMemories(nextMemories)
      setMedicalRecords(nextMedicalRecords)
    } catch {
      setLoadError('生活记录暂时没有加载成功，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }, [currentPetId, month, repository, selectedDate])

  useEffect(() => { void loadEntries() }, [loadEntries])
  useEffect(() => {
    if (!currentPetId) return
    const storedStates = localStorage.getItem(`petplanet:tasks:${currentPetId}`)
    const storedTodos = localStorage.getItem(`petplanet:custom-todos:${currentPetId}`)
    const storedDismissed = localStorage.getItem(`petplanet:dismissed-reminders:${currentPetId}`)
    setTaskStates(storedStates ? JSON.parse(storedStates) as Record<string, TaskStatus> : {})
    setCustomTodos(storedTodos ? JSON.parse(storedTodos) as CustomTodo[] : [])
    setDismissedReminderKeys(storedDismissed ? JSON.parse(storedDismissed) as string[] : [])
  }, [currentPetId])
  useEffect(() => {
    const next = searchParams.get('new')
    if (next === 'feeding') setCareOpen('feeding')
    if (next === 'water') setCareOpen('water')
    if (next === 'consumption') setConsumptionOpen(true)
    if (next === 'weight') setWeightOpen(true)
    if (next === 'photo') setPhotoOpen(true)
  }, [searchParams])

  const total = entries.reduce((sum, item) => sum + item.cost, 0)
  const categories = useMemo(() => ['全部', ...Array.from(new Set(entries.map((item) => item.category)))], [entries])
  const visibleEntries = category === '全部' ? entries : entries.filter((item) => item.category === category)
  const latestWeight = weights.at(-1)
  const previousWeight = weights.at(-2)
  const weightChange = latestWeight && previousWeight ? latestWeight.weightKg - previousWeight.weightKg : 0
  const feedingTotal = careEvents.filter((item) => item.kind === 'feeding').reduce((sum, item) => sum + item.amount, 0)
  const waterTotal = careEvents.filter((item) => item.kind === 'water').reduce((sum, item) => sum + item.amount, 0)
  const photoMemories = [...memories].filter((item) => item.photos.length > 0).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  const reminderTasks = useMemo(
    () => buildReminderTasks(currentPet, medicalRecords, customTodos)
      .filter((task) => !task.dismissKey || !dismissedReminderKeys.includes(task.dismissKey)),
    [currentPet, customTodos, dismissedReminderKeys, medicalRecords],
  )
  const completedReminderCount = reminderTasks.filter((task) => taskStates[task.id] === 'done').length
  const remindersTargeted = searchParams.get('section') === 'reminders'

  const changeMonth = (offset: number) => {
    const date = new Date(`${month}-01T00:00:00`)
    date.setMonth(date.getMonth() + offset)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    setCategory('全部')
  }

  const closeComposer = () => {
    setConsumptionOpen(false)
    setWeightOpen(false)
    setCareOpen(null)
    setPhotoOpen(false)
    if (searchParams.has('new')) setSearchParams({}, { replace: true })
  }

  const handleCareSaved = (event: CareEvent) => {
    setSelectedDate(event.occurredAt.slice(0, 10))
    setCareEvents((current) => [event, ...current].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)))
  }

  const handlePhotoSaved = (memory: Memory) => {
    setMemories((current) => [...current, memory])
  }

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
    const nextTodos = customTodos.filter((todo) => todo.id !== id)
    const nextStates = { ...taskStates }
    delete nextStates[id]
    setCustomTodos(nextTodos)
    setTaskStates(nextStates)
    localStorage.setItem(`petplanet:custom-todos:${currentPetId}`, JSON.stringify(nextTodos))
    localStorage.setItem(`petplanet:tasks:${currentPetId}`, JSON.stringify(nextStates))
  }

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

  const removeTarget = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      if (deleteTarget.kind === 'reminder') {
        dismissReminder(deleteTarget.item)
        setDeleteTarget(null)
        return
      }
      if (deleteTarget.kind === 'todo') {
        removeTodo(deleteTarget.item.id)
        setDeleteTarget(null)
        return
      }
      if (deleteTarget.kind === 'consumption') await repository.removeConsumption(deleteTarget.item.id)
      if (deleteTarget.kind === 'care') await repository.removeCareEvent(deleteTarget.item.id)
      if (deleteTarget.kind === 'weight') {
        await repository.removeWeight(deleteTarget.item.id)
        await refreshPets()
      }
      setDeleteTarget(null)
      await loadEntries()
    } catch {
      setDeleteError('删除没有完成，请稍后重试。')
    } finally {
      setDeleting(false)
    }
  }

  const deleteTitle = deleteTarget?.kind === 'reminder'
    ? '移除这条提醒？'
    : deleteTarget?.kind === 'todo'
    ? '删除这条待办？'
    : deleteTarget?.kind === 'consumption'
    ? '删除这条消耗记录？'
    : deleteTarget?.kind === 'weight'
      ? '删除这条体重记录？'
      : '删除这条照护记录？'

  const deleteDescription = deleteTarget?.kind === 'reminder'
    ? '只会从提醒列表中移除，不会删除宠物档案或病历。'
    : '删除后无法恢复，相关统计会立即重新计算。'

  return (
    <div className="page life-page">
      <header className="page-header life-page-header">
        <div>
          <p className="eyebrow">{currentPet?.name ?? '宠物'} · DAILY RHYTHM</p>
          <h1>日常记录</h1>
          <p>把每一次吃饭、喝水和成长变化，慢慢收进共同生活的轨迹里。</p>
        </div>
        <div className="header-actions">
          <button className="button primary" onClick={() => setConsumptionOpen(true)}><Plus size={19} />记录消耗</button>
        </div>
      </header>

      {loading ? (
        <div className="content-state" aria-live="polite"><span className="loading-dot" />正在整理生活记录…</div>
      ) : loadError ? (
        <div className="content-state error-state" role="alert"><p>{loadError}</p><button className="button secondary" onClick={() => void loadEntries()}>重新加载</button></div>
      ) : (
        <>
          <section
            id="reminders"
            className={`daily-reminders ${remindersTargeted ? 'is-targeted' : ''}`}
            aria-labelledby="daily-reminders-title"
          >
            <div className="daily-care-heading">
              <div>
                <p className="eyebrow">REMINDERS</p>
                <h2 id="daily-reminders-title">待办与提醒</h2>
                <p>统一管理 {currentPet?.name} 的今日待办、照护提醒和复诊安排。</p>
              </div>
              <div className="reminder-heading-actions">
                <span>{completedReminderCount}/{reminderTasks.length} 已完成</span>
                <button className="button primary" onClick={() => setTodoFormOpen(true)}><Plus size={17} />添加待办</button>
              </div>
            </div>
            <div className="reminder-manager-list">
              {reminderTasks.map((task) => {
                const status = taskStates[task.id]
                const customTodo = task.isCustom ? customTodos.find((todo) => todo.id === task.id) : undefined
                return (
                  <article key={task.id} className={`care-row ${status ?? ''}`}>
                    <span className="care-row-icon">
                      {status === 'done' ? <Check size={18} /> : status === 'later' ? <ClockCountdown size={18} /> : <Bell size={18} />}
                    </span>
                    <div>
                      <strong>{task.title}</strong>
                      <p>{task.detail}</p>
                      <time>{task.due}</time>
                    </div>
                    <div className="reminder-manager-actions">
                      {status ? (
                        <b>{status === 'done' ? `${task.title}已完成` : `${task.title}已稍后提醒`}</b>
                      ) : (
                        <>
                          <button aria-label={`完成${task.title}`} onClick={() => updateTask(task.id, 'done')}>完成</button>
                          <button aria-label={`稍后处理${task.title}`} onClick={() => updateTask(task.id, 'later')}>稍后</button>
                        </>
                      )}
                      {customTodo && (
                        <button
                          className="reminder-delete"
                          aria-label={`删除${task.title}待办`}
                          onClick={() => { setDeleteError(''); setDeleteTarget({ kind: 'todo', item: customTodo }) }}
                        >
                          <Trash size={15} />
                        </button>
                      )}
                      {!customTodo && task.dismissKey && (
                        <button
                          className="reminder-delete"
                          aria-label={`删除${task.title}提醒`}
                          onClick={() => { setDeleteError(''); setDeleteTarget({ kind: 'reminder', item: task }) }}
                        >
                          <Trash size={15} />
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="daily-care-hub" aria-labelledby="daily-care-title">
            <div className="daily-care-heading">
              <div>
                <p className="eyebrow">DAILY CARE</p>
                <h2 id="daily-care-title">今日照护</h2>
                <p>{selectedDate === localDate() ? '今天' : selectedDate}，已经留下 {careEvents.length} 次照护记录</p>
              </div>
              <div className="day-switcher" aria-label="照护日期">
                <button aria-label="前一天" onClick={() => setSelectedDate((value) => shiftDate(value, -1))}><CaretLeft size={17} /></button>
                <strong>{selectedDate.slice(5).replace('-', ' / ')}</strong>
                <button aria-label="后一天" onClick={() => setSelectedDate((value) => shiftDate(value, 1))}><CaretRight size={17} /></button>
              </div>
            </div>

            <div className="care-action-grid">
              <button aria-label="记录喂食" onClick={() => setCareOpen('feeding')}><span><BowlFood size={22} weight="duotone" /></span><strong>记录喂食</strong><small>{feedingTotal > 0 ? `今日 ${feedingTotal} g` : '添加一餐'}</small></button>
              <button aria-label="记录饮水" onClick={() => setCareOpen('water')}><span><Drop size={22} weight="duotone" /></span><strong>记录饮水</strong><small>{waterTotal > 0 ? `今日 ${waterTotal} ml` : '补充饮水'}</small></button>
              <button aria-label="记录体重" onClick={() => setWeightOpen(true)}><span><Scales size={22} weight="duotone" /></span><strong>记录体重</strong><small>{latestWeight ? `最近 ${latestWeight.weightKg} kg` : '按需测量'}</small></button>
              <button aria-label="上传照片" onClick={() => setPhotoOpen(true)}><span><Camera size={22} weight="duotone" /></span><strong>上传照片</strong><small>自选拍摄时间</small></button>
            </div>

            <div className="care-detail-grid">
              <section className="care-timeline" aria-labelledby="care-timeline-title">
                <div className="care-panel-heading">
                  <div><span>DAY LOG</span><h3 id="care-timeline-title">当天时间线</h3></div>
                  <p>{feedingTotal} g 喂食 · {waterTotal} ml 饮水</p>
                </div>
                {careEvents.length > 0 ? (
                  <div className="care-event-list">
                    {careEvents.map((event) => {
                      const { Icon, label } = careCopy[event.kind]
                      return (
                        <article className={`care-event ${event.kind}`} key={event.id}>
                          <time>{event.occurredAt.slice(11, 16)}</time>
                          <span><Icon size={18} weight="duotone" /></span>
                          <div><strong>{label}</strong><small>已记录在 {currentPet?.name} 的生活里</small></div>
                          <b>{event.amount} {event.unit}</b>
                          <button aria-label={`删除${event.occurredAt.slice(11, 16)}${label}记录`} onClick={() => { setDeleteError(''); setDeleteTarget({ kind: 'care', item: event }) }}><Trash size={15} /></button>
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <div className="care-empty"><BowlFood size={28} weight="duotone" /><strong>这一天还没有照护记录</strong><p>每次喂食和饮水都单独记录，时间线会更清楚。</p></div>
                )}
              </section>

              <section className="weight-chart-panel care-weight-panel" aria-labelledby="weight-title">
                <div className="chart-heading"><div><span className="panel-kicker">体重趋势</span><p id="weight-title">不必每天记录，按需要测量即可</p></div><strong>{latestWeight?.weightKg ?? '--'}kg</strong></div>
                {weights.length > 0 ? (
                  <ResponsiveContainer width="100%" height={178}>
                    <LineChart data={weights.slice(-8)} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                      <XAxis dataKey="measuredAt" tickFormatter={(value) => value.slice(5)} axisLine={false} tickLine={false} />
                      <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                      <Tooltip formatter={(value) => [`${value} kg`, '体重']} labelFormatter={(value) => `测量日期 ${value}`} />
                      <Line type="monotone" dataKey="weightKg" stroke="#a85340" strokeWidth={3} dot={{ fill: '#fff9f3', stroke: '#a85340', strokeWidth: 3, r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div className="empty-state compact">还没有体重记录。</div>}
                <div className="care-weight-footer">
                  <span>{weightChange === 0 ? '较上次持平' : `较上次 ${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg`}</span>
                  <button className="text-button" onClick={() => setWeightOpen(true)}>新增测量</button>
                </div>
                {weights.length > 0 && <div className="weight-log">{weights.slice(-3).reverse().map((weight) => <div key={weight.id}><span>{weight.measuredAt}</span><strong>{weight.weightKg} kg</strong><button aria-label={`删除${weight.measuredAt}体重记录`} onClick={() => { setDeleteError(''); setDeleteTarget({ kind: 'weight', item: weight }) }}><Trash size={16} /></button></div>)}</div>}
              </section>
            </div>

            <section className="life-photo-section" aria-labelledby="life-photo-title">
              <div className="care-panel-heading">
                <div><span>LIFE PHOTOS</span><h3 id="life-photo-title">生活照片</h3></div>
                <button className="text-button" onClick={() => setPhotoOpen(true)}><Camera size={16} />添加照片</button>
              </div>
              {photoMemories.length > 0 ? (
                <div className="life-photo-strip">
                  {photoMemories.map((memory) => (
                    <article key={memory.id}>
                      <img src={memory.photos[0]} alt={memory.note} />
                      <div><time>{memory.occurredAt.replace('T', ' ').slice(0, 16)}</time><strong>{memory.note}</strong></div>
                    </article>
                  ))}
                </div>
              ) : <div className="care-empty"><Camera size={28} weight="duotone" /><strong>还没有生活照片</strong><p>照片会统一汇总在这里，不必每天建立相册。</p></div>}
            </section>
          </section>

          <section className="monthly-life-section" aria-labelledby="monthly-life-title">
            <div className="section-heading monthly-heading"><div><p className="eyebrow">MONTHLY BENTO</p><h2 id="monthly-life-title">月度生活汇总</h2></div><span>消耗与花费</span></div>
            <div className="month-switcher">
              <button aria-label="上个月" onClick={() => changeMonth(-1)}><CaretLeft size={18} /></button>
              <strong>{month.slice(0, 4)} 年 {Number(month.slice(5))} 月</strong>
              <button aria-label="下个月" onClick={() => changeMonth(1)}><CaretRight size={18} /></button>
            </div>

            <section className="life-metrics" aria-label="本月概览">
              <article><span><ShoppingBagOpen size={21} />本月花费</span><strong>¥{total}</strong><small>{entries.length} 条消耗记录</small></article>
              <article><span><ChartLineUp size={21} />照护类别</span><strong>{categories.length - 1}</strong><small>{entries.length > 0 ? entries.slice(0, 3).map((item) => item.category).join('、') : '本月尚无记录'}</small></article>
            </section>

            <section className="record-table" aria-labelledby="consumption-title">
              <div className="section-heading"><div><p className="eyebrow">MONTHLY ITEMS</p><h2 id="consumption-title">本月消耗</h2></div><span>用量与花费</span></div>
              <div className="category-filters" aria-label="消耗类别筛选">
                {categories.map((item) => <button key={item} className={category === item ? 'active' : ''} aria-label={item === '全部' ? '查看全部类别' : `只看${item}`} onClick={() => setCategory(item)}>{item}</button>)}
              </div>
              <div className="record-table-head"><span>类别</span><span>用量</span><span>花费</span><span>操作</span></div>
              {visibleEntries.map((entry) => (
                <div className="record-row" key={entry.id}>
                  <strong>{entry.category}</strong>
                  <span>{entry.quantity} {entry.unit}</span>
                  <b>¥{entry.cost}</b>
                  <button aria-label={`删除${entry.category}记录`} onClick={() => { setDeleteError(''); setDeleteTarget({ kind: 'consumption', item: entry }) }}><Trash size={17} />删除</button>
                </div>
              ))}
              {visibleEntries.length === 0 && <div className="empty-state compact"><ShoppingBagOpen size={30} weight="duotone" /><h3>这个筛选下还没有记录</h3><p>可以新增一条消耗，或切换月份和类别。</p><button className="button primary" onClick={() => setConsumptionOpen(true)}>记录消耗</button></div>}
            </section>
          </section>
        </>
      )}

      {deleteTarget && <ConfirmDialog title={deleteTitle} description={deleteDescription} pending={deleting} error={deleteError} onCancel={() => setDeleteTarget(null)} onConfirm={() => void removeTarget()} />}
      {consumptionOpen && <ConsumptionForm month={month} onClose={closeComposer} onSaved={() => void loadEntries()} />}
      {weightOpen && <WeightForm onClose={closeComposer} onSaved={() => void loadEntries()} />}
      {careOpen && <CareEventForm kind={careOpen} onClose={closeComposer} onSaved={handleCareSaved} />}
      {photoOpen && <LifePhotoForm onClose={closeComposer} onSaved={handlePhotoSaved} />}
      {todoFormOpen && <TodoForm onClose={() => setTodoFormOpen(false)} onSaved={saveTodo} />}
    </div>
  )
}
