import {
  Bell,
  Check,
  ClockCountdown,
  FirstAidKit,
  Plus,
  Scales,
  ShoppingBagOpen,
  TrendUp,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePetData } from '../../data/PetDataProvider'
import type { ConsumptionEntry, MedicalRecord, WeightEntry } from '../../domain/types'
import { PetForm } from './PetForm'

type TaskStatus = 'done' | 'later'

export function HomePage() {
  const { pets, currentPet, currentPetId, selectPet, repository } = usePetData()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [weights, setWeights] = useState<WeightEntry[]>([])
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([])
  const [consumptions, setConsumptions] = useState<ConsumptionEntry[]>([])
  const [petFormMode, setPetFormMode] = useState<'add' | 'edit' | null>(null)
  const [taskStates, setTaskStates] = useState<Record<string, TaskStatus>>({})
  const month = new Date().toISOString().slice(0, 7)

  useEffect(() => {
    if (searchParams.get('addPet') === '1') setPetFormMode('add')
  }, [searchParams])

  useEffect(() => {
    if (!currentPetId) return
    const stored = localStorage.getItem(`petplanet:tasks:${currentPetId}`)
    setTaskStates(stored ? JSON.parse(stored) as Record<string, TaskStatus> : {})
    void Promise.all([
      repository.listWeights(currentPetId),
      repository.listMedicalRecords(currentPetId),
      repository.listConsumptions(currentPetId, month),
    ]).then(([nextWeights, nextMedical, nextConsumptions]) => {
      setWeights(nextWeights)
      setMedicalRecords(nextMedical)
      setConsumptions(nextConsumptions)
    })
  }, [currentPetId, month, repository])

  const latestMedical = medicalRecords[0]
  const followUp = medicalRecords.find((record) => record.status === 'follow-up')
  const totalCost = consumptions.reduce((sum, item) => sum + item.cost, 0)
  const mainFood = consumptions.find((item) => /主粮|狗粮|猫粮/.test(item.category))
  const tasks = useMemo(() => currentPet ? [
    { id: 'reminder', title: currentPet.reminder, due: currentPet.reminderDate, detail: `${currentPet.name}的日常照护提醒` },
    ...(followUp ? [{ id: 'follow-up', title: '复诊', due: followUp.followUpDate, detail: followUp.diagnosis }] : []),
    { id: 'weight', title: '月度体重', due: '本月结束前', detail: '更新一次体重，保持趋势连续' },
  ] : [], [currentPet, followUp])

  const updateTask = (id: string, status: TaskStatus) => {
    const next = { ...taskStates, [id]: status }
    setTaskStates(next)
    localStorage.setItem(`petplanet:tasks:${currentPetId}`, JSON.stringify(next))
  }

  const closePetForm = () => {
    setPetFormMode(null)
    if (searchParams.has('addPet')) setSearchParams({})
  }

  return (
    <div className="page home-page">
      <header className="page-header home-header">
        <div>
          <p className="eyebrow">PETPLANET · 今日照护</p>
          <h1>今天也一起好好生活</h1>
          <p>把需要做的事放在眼前，把变化慢慢留在记录里。</p>
        </div>
        <div className="header-actions">
          <button className="button secondary" onClick={() => navigate('/health?new=1')}><FirstAidKit size={19} />记录病历</button>
          <button className="button primary" onClick={() => navigate('/life?new=consumption')}><Plus size={19} />记录消耗</button>
        </div>
      </header>

      <div className="dashboard-columns">
        <div className="dashboard-main">
          <section aria-labelledby="pet-section-title">
            <div className="section-heading">
              <div><p className="eyebrow">我的小家伙们</p><h2 id="pet-section-title">宠物角色卡</h2></div>
              <div className="section-actions">
                <button className="text-button" onClick={() => navigate('/pets')}>查看档案</button>
                <button className="text-button" onClick={() => setPetFormMode('add')}><Plus size={18} />添加宠物</button>
              </div>
            </div>
            <div className="pet-card-row compact-cards">
              {pets.map((pet) => (
                <button key={pet.id} className={`pet-card ${pet.id === currentPetId ? 'active' : ''}`} onClick={() => selectPet(pet.id)} aria-label={`选择${pet.name}`}>
                  <div className="pet-card-top"><img src={pet.avatar} alt={pet.name} /><div><strong>{pet.name}</strong><span>{pet.breed} · {pet.ageLabel}</span></div><i aria-hidden="true" /></div>
                  <div className="pet-tags"><span>{pet.status}</span><span>{pet.currentWeight}kg</span></div>
                  <div className="reminder-line"><span>下一提醒<strong>{pet.reminder}</strong></span><b>{pet.reminderDate}</b></div>
                </button>
              ))}
              <button className="pet-card add-pet-card" onClick={() => setPetFormMode('add')}><Plus size={25} /><span>迎接新的家庭成员</span></button>
            </div>
          </section>

          {currentPet && (
            <section className="overview-section" aria-labelledby="overview-title">
              <div className="section-heading">
                <div><p className="eyebrow">本月数据</p><h2 id="overview-title">{currentPet.name}的本月概览</h2></div>
                <button className="soft-badge pet-manage" onClick={() => navigate('/pets')}>管理档案</button>
              </div>
              <div className="overview-grid dashboard-metrics">
                <article className="metric-panel health-note">
                  <span className="panel-kicker"><FirstAidKit size={19} />最近健康</span>
                  <h3>{latestMedical?.diagnosis ?? '还没有健康记录'}</h3>
                  <p>{latestMedical ? `${latestMedical.visitDate} · ${latestMedical.symptoms}` : '新增第一条病历，建立连续的健康档案。'}</p>
                  <button className="inline-link" onClick={() => navigate('/health')}>查看健康档案</button>
                </article>
                <article className="metric-panel">
                  <span className="panel-kicker"><TrendUp size={19} />体重趋势</span>
                  <div className="metric-value">{weights.at(-1)?.weightKg ?? currentPet.currentWeight}<small>kg</small></div>
                  <div className="mini-chart" aria-label="近月体重趋势">{weights.slice(-5).map((weight, index) => <i key={weight.id} style={{ height: `${30 + index * 10}%` }} />)}</div>
                </article>
                <article className="metric-panel spending-panel">
                  <span className="panel-kicker"><ShoppingBagOpen size={19} />本月消耗</span>
                  <div className="metric-value">¥{totalCost}</div>
                  <p>{consumptions.length} 项记录 · {mainFood ? `${mainFood.category} ${mainFood.quantity} ${mainFood.unit}` : '尚未记录主粮'}</p>
                  <button className="inline-link" onClick={() => navigate('/life')}>查看生活记录</button>
                </article>
              </div>

              <div className="recent-records">
                <div className="section-heading"><h3>最近记录</h3><span>根据当前宠物自动更新</span></div>
                <div className="activity-list derived-activity">
                  {latestMedical && <div><i><FirstAidKit size={18} /></i><span><b>{latestMedical.diagnosis}</b> · {latestMedical.clinic || '健康记录'}</span><time>{latestMedical.visitDate}</time></div>}
                  {weights.at(-1) && <div><i><Scales size={18} /></i><span>体重更新为 <b>{weights.at(-1)?.weightKg}kg</b></span><time>{weights.at(-1)?.measuredAt}</time></div>}
                  {consumptions.at(-1) && <div><i><ShoppingBagOpen size={18} /></i><span>记录了 <b>{consumptions.at(-1)?.category}</b></span><time>{consumptions.at(-1)?.month}</time></div>}
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="today-panel" aria-labelledby="today-title">
          <div className="today-heading"><div><p className="eyebrow">TODAY</p><h2 id="today-title">今日待办</h2></div><span>{tasks.filter((task) => !taskStates[task.id]).length} 项</span></div>
          <div className="task-list">
            {tasks.map((task) => {
              const status = taskStates[task.id]
              return (
                <article key={task.id} className={`task-item ${status ?? ''}`}>
                  <span className="task-icon">{status === 'done' ? <Check size={18} /> : status === 'later' ? <ClockCountdown size={18} /> : <Bell size={18} />}</span>
                  <div><strong>{task.title}</strong><p>{task.detail}</p><time>{task.due}</time></div>
                  {status ? <b className="task-result">{task.title}{status === 'done' ? '已完成' : '已稍后提醒'}</b> : <footer><button aria-label={`完成${task.title}`} onClick={() => updateTask(task.id, 'done')}>完成</button><button aria-label={`稍后处理${task.title}`} onClick={() => updateTask(task.id, 'later')}>稍后</button></footer>}
                </article>
              )
            })}
          </div>
        </aside>
      </div>

      {petFormMode && <PetForm pet={petFormMode === 'edit' ? currentPet : undefined} onClose={closePetForm} onSaved={(pet) => { if (pet) selectPet(pet.id) }} />}
    </div>
  )
}
