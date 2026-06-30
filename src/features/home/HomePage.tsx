import {
  ArrowRight,
  Bell,
  Camera,
  Check,
  ClockCountdown,
  FirstAidKit,
  Plus,
  Scales,
  ShoppingBagOpen,
  Sparkle,
} from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { usePetData } from '../../data/PetDataProvider'
import type { ConsumptionEntry, MedicalRecord, Memory, WeightEntry } from '../../domain/types'
import { PetForm } from './PetForm'

type TaskStatus = 'done' | 'later'

export function HomePage() {
  const { currentPet, currentPetId, selectPet, repository } = usePetData()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [weights, setWeights] = useState<WeightEntry[]>([])
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([])
  const [consumptions, setConsumptions] = useState<ConsumptionEntry[]>([])
  const [memories, setMemories] = useState<Memory[]>([])
  const [petFormOpen, setPetFormOpen] = useState(false)
  const [taskStates, setTaskStates] = useState<Record<string, TaskStatus>>({})
  const month = new Date().toISOString().slice(0, 7)
  const monthLabel = new Intl.DateTimeFormat('zh-CN', { month: 'long' }).format(new Date())

  useEffect(() => {
    if (searchParams.get('addPet') === '1') setPetFormOpen(true)
  }, [searchParams])

  useEffect(() => {
    if (!currentPetId) return
    const stored = localStorage.getItem('petplanet:tasks:' + currentPetId)
    setTaskStates(stored ? JSON.parse(stored) as Record<string, TaskStatus> : {})
    void Promise.all([
      repository.listWeights(currentPetId),
      repository.listMedicalRecords(currentPetId),
      repository.listConsumptions(currentPetId, month),
      repository.listMemories(currentPetId),
    ]).then(([nextWeights, nextMedical, nextConsumptions, nextMemories]) => {
      setWeights(nextWeights)
      setMedicalRecords(nextMedical)
      setConsumptions(nextConsumptions)
      setMemories(nextMemories)
    })
  }, [currentPetId, month, repository])

  const latestMedical = medicalRecords[0]
  const followUp = medicalRecords.find((record) => record.status === 'follow-up')
  const totalCost = consumptions.reduce((sum, item) => sum + item.cost, 0)
  const photoCount = memories.reduce((sum, item) => sum + item.photos.length, 0)
  const latestWeight = weights.at(-1)?.weightKg ?? currentPet?.currentWeight ?? 0
  const tasks = useMemo(() => currentPet ? [
    {
      id: 'reminder',
      title: currentPet.reminder,
      due: currentPet.reminderDate,
      detail: currentPet.name + '的日常照护提醒',
    },
    ...(followUp ? [{
      id: 'follow-up',
      title: '复诊',
      due: followUp.followUpDate,
      detail: followUp.diagnosis,
    }] : []),
    {
      id: 'weight',
      title: '月度体重',
      due: '本月结束前',
      detail: '更新一次体重，保持趋势连续',
    },
  ] : [], [currentPet, followUp])

  const completedCount = tasks.filter((task) => taskStates[task.id] === 'done').length
  const previewPhotos = memories
    .slice()
    .reverse()
    .flatMap((memory) => memory.photos)
    .slice(0, 3)
  const memoryPhotos = previewPhotos.length > 0
    ? previewPhotos
    : currentPet?.avatar
      ? [currentPet.avatar]
      : []

  const updateTask = (id: string, status: TaskStatus) => {
    const next = { ...taskStates, [id]: status }
    setTaskStates(next)
    localStorage.setItem('petplanet:tasks:' + currentPetId, JSON.stringify(next))
  }

  const closePetForm = () => {
    setPetFormOpen(false)
    if (searchParams.has('addPet')) setSearchParams({})
  }

  if (!currentPet) {
    return (
      <div className="page home-page">
        <section className="empty-state">
          <h1>先迎接一位家庭成员</h1>
          <p>建立宠物档案后，PetPlanet 会为你整理每天的照护与成长。</p>
          <button className="button primary" onClick={() => setPetFormOpen(true)}>
            <Plus size={18} />添加宠物
          </button>
        </section>
        {petFormOpen && <PetForm onClose={closePetForm} onSaved={(pet) => pet && selectPet(pet.id)} />}
      </div>
    )
  }

  return (
    <div className="page home-page app-home">
      <header className="home-welcome">
        <div>
          <p className="eyebrow">PETPLANET · {monthLabel}陪伴</p>
          <h1>今天也一起好好生活</h1>
          <p>照顾好今天，也把共同生活的变化慢慢留下来。</p>
        </div>
        <button className="home-record-button" onClick={() => navigate('/life?new=consumption')}>
          <Plus size={18} />记录一下
        </button>
      </header>

      <section className="current-pet-hero" data-testid="current-pet-hero" aria-labelledby="current-pet-name">
        <div className="current-pet-photo">
          <img src={currentPet.avatar} alt={currentPet.name + '的照片'} />
          <span><Sparkle size={15} weight="fill" />今日状态很好</span>
        </div>
        <div className="current-pet-copy">
          <p className="hero-kicker">MY COMPANION</p>
          <h2 id="current-pet-name">{currentPet.name}</h2>
          <p>{currentPet.breed} · {currentPet.ageLabel}</p>
          <dl>
            <div>
              <dt>今日照护</dt>
              <dd>{completedCount}/{tasks.length}</dd>
            </div>
            <div>
              <dt>当前体重</dt>
              <dd>{latestWeight}kg</dd>
            </div>
          </dl>
          <button className="hero-profile-link" onClick={() => navigate('/pets')}>
            查看完整档案<ArrowRight size={16} />
          </button>
        </div>
      </section>

      <section className="today-care" data-testid="today-care" aria-labelledby="today-care-title">
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">TODAY</p>
            <h2 id="today-care-title">今日照护</h2>
          </div>
          <span>{completedCount}/{tasks.length} 已完成</span>
        </div>
        <div className="care-timeline">
          {tasks.map((task) => {
            const status = taskStates[task.id]
            return (
              <article key={task.id} className={'care-row ' + (status ?? '')}>
                <span className="care-row-icon">
                  {status === 'done'
                    ? <Check size={18} />
                    : status === 'later'
                      ? <ClockCountdown size={18} />
                      : <Bell size={18} />}
                </span>
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.detail}</p>
                  <time>{task.due}</time>
                </div>
                {status ? (
                  <b>{status === 'done' ? task.title + '已完成' : task.title + '已稍后提醒'}</b>
                ) : (
                  <footer>
                    <button aria-label={'完成' + task.title} onClick={() => updateTask(task.id, 'done')}>完成</button>
                    <button aria-label={'稍后处理' + task.title} onClick={() => updateTask(task.id, 'later')}>稍后</button>
                  </footer>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section className="monthly-bento" data-testid="monthly-bento" aria-labelledby="monthly-bento-title">
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">MONTHLY BENTO</p>
            <h2 id="monthly-bento-title">{monthLabel}概览</h2>
          </div>
          <button onClick={() => navigate('/life')}>查看全部<ArrowRight size={15} /></button>
        </div>
        <div className="bento-grid">
          <button className="bento-card bento-weight" onClick={() => navigate('/life?new=weight')}>
            <span><Scales size={20} />体重趋势</span>
            <strong>{latestWeight}<small>kg</small></strong>
            <div className="weight-sparkline" aria-label="近月体重变化">
              {weights.slice(-5).map((weight) => <i key={weight.id} style={{ height: Math.max(26, weight.weightKg * 1.8) + '%' }} />)}
            </div>
          </button>
          <button className="bento-card" onClick={() => navigate('/life')}>
            <span><ShoppingBagOpen size={18} />本月花费</span>
            <strong>¥{totalCost}</strong>
          </button>
          <button className="bento-card" onClick={() => navigate('/health')}>
            <span><FirstAidKit size={18} />健康记录</span>
            <strong>{medicalRecords.length}<small>次</small></strong>
          </button>
          <button className="bento-card bento-photos" onClick={() => navigate('/memories')}>
            <span><Camera size={18} />生活照片</span>
            <strong>{photoCount}<small>张</small></strong>
          </button>
        </div>
      </section>

      <section className="memory-preview" data-testid="memory-preview" aria-labelledby="memory-preview-title">
        <div className="memory-preview-copy">
          <p className="eyebrow">MEMORY GARDEN</p>
          <h2 id="memory-preview-title">翻开{monthLabel}的故事</h2>
          <p>那些普通又珍贵的日子，正在慢慢成为你们的回忆星河。</p>
          <Link to="/memories" aria-label="打开生活回忆">
            打开生活回忆<ArrowRight size={17} />
          </Link>
        </div>
        <div className="memory-photo-stack">
          {memoryPhotos.map((photo, index) => (
            <img key={photo + '-' + index} src={photo} alt="" />
          ))}
        </div>
      </section>

      {petFormOpen && (
        <PetForm
          onClose={closePetForm}
          onSaved={(pet) => {
            if (pet) selectPet(pet.id)
          }}
        />
      )}
    </div>
  )
}
