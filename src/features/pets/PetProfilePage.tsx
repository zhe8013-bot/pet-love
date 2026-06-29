import { FirstAidKit, NotePencil, Scales, ShoppingBagOpen, Trash } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePetData } from '../../data/PetDataProvider'
import type { ConsumptionEntry, MedicalRecord, WeightEntry } from '../../domain/types'
import { PetForm } from '../home/PetForm'

const currentMonth = new Date().toISOString().slice(0, 7)

export function PetProfilePage() {
  const { currentPet, currentPetId, repository } = usePetData()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([])
  const [weights, setWeights] = useState<WeightEntry[]>([])
  const [consumptions, setConsumptions] = useState<ConsumptionEntry[]>([])

  useEffect(() => {
    if (!currentPetId) return
    void Promise.all([
      repository.listMedicalRecords(currentPetId),
      repository.listWeights(currentPetId),
      repository.listConsumptions(currentPetId, currentMonth),
    ]).then(([nextMedical, nextWeights, nextConsumptions]) => {
      setMedicalRecords(nextMedical)
      setWeights(nextWeights)
      setConsumptions(nextConsumptions)
    })
  }, [currentPetId, repository])

  if (!currentPet) return <div className="page"><div className="empty-state">请先添加一只宠物。</div></div>

  const latestMedical = medicalRecords[0]
  const totalCost = consumptions.reduce((sum, item) => sum + item.cost, 0)

  return (
    <div className="page profile-page">
      <header className="page-header profile-heading">
        <div>
          <p className="eyebrow">PET PROFILE</p>
          <h1>宠物档案</h1>
          <p>{currentPet.name}的照护档案</p>
        </div>
      </header>

      <section className="profile-hero">
        <img src={currentPet.avatar} alt={currentPet.name} />
        <div className="profile-identity">
          <span className="status-chip">{currentPet.status}</span>
          <h2>{currentPet.name}</h2>
          <p>{currentPet.breed} · {currentPet.ageLabel}</p>
          <dl>
            <div><dt>生日</dt><dd>{currentPet.birthDate}</dd></div>
            <div><dt>当前体重</dt><dd>{currentPet.currentWeight} kg</dd></div>
            <div><dt>下一提醒</dt><dd>{currentPet.reminder} · {currentPet.reminderDate}</dd></div>
          </dl>
        </div>
        <div className="profile-actions">
          <button className="button primary" onClick={() => setEditing(true)}><NotePencil size={18} />编辑资料</button>
        </div>
      </section>

      <section className="quick-action-grid" aria-label="快捷记录">
        <button onClick={() => navigate('/health?new=1')}><FirstAidKit size={22} /><span>新增病历<small>记录本次就诊</small></span></button>
        <button onClick={() => navigate('/life?new=weight')}><Scales size={22} /><span>记录体重<small>更新成长趋势</small></span></button>
        <button onClick={() => navigate('/life?new=consumption')}><ShoppingBagOpen size={22} /><span>记录消耗<small>补充本月照护</small></span></button>
      </section>

      <div className="profile-grid">
        <section className="profile-section reminders-panel">
          <div className="section-heading"><h2>关键提醒</h2><span>未来 30 天</span></div>
          <div className="reminder-list">
            <div><span className="reminder-dot coral" /><p><strong>{currentPet.reminder}</strong><small>{currentPet.reminderDate}</small></p><b>待完成</b></div>
            {latestMedical?.followUpDate && <div><span className="reminder-dot lavender" /><p><strong>复诊</strong><small>{latestMedical.followUpDate}</small></p><b>待复诊</b></div>}
            <div><span className="reminder-dot gold" /><p><strong>月度体重</strong><small>本月结束前</small></p><b>建议</b></div>
          </div>
        </section>

        <section className="profile-section health-summary">
          <div className="section-heading"><h2>最近健康摘要</h2><button onClick={() => navigate('/health')}>查看全部</button></div>
          {latestMedical ? <><span>{latestMedical.visitDate}</span><h3>{latestMedical.diagnosis}</h3><p>{latestMedical.symptoms}</p></> : <div className="empty-state compact">还没有病历记录。</div>}
        </section>

        <section className="profile-section weight-overview">
          <div className="section-heading"><h2>近 6 月体重</h2><span>{weights.at(-1)?.weightKg ?? currentPet.currentWeight} kg</span></div>
          <div className="weight-bars" aria-label="近 6 月体重趋势">
            {weights.slice(-6).map((weight, index) => <i key={weight.id} style={{ height: `${42 + index * 8}%` }} title={`${weight.measuredAt} ${weight.weightKg}kg`} />)}
          </div>
        </section>

        <section className="profile-section care-summary">
          <div className="section-heading"><h2>本月照护</h2><span>{currentMonth}</span></div>
          <div className="care-numbers"><div><strong>{consumptions.length}</strong><span>条记录</span></div><div><strong>¥{totalCost}</strong><span>本月花费</span></div></div>
        </section>
      </div>

      {editing && <PetForm pet={currentPet} onClose={() => setEditing(false)} onSaved={() => undefined} />}
    </div>
  )
}
