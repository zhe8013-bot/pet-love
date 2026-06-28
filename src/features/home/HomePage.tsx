import { BowlFood, FirstAidKit, Footprints, Plus, Sparkle, TrendUp } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePetData } from '../../data/PetDataProvider'
import type { MonthlySummary, WeightEntry } from '../../domain/types'
import { PetForm } from './PetForm'

export function HomePage() {
  const { pets, currentPet, currentPetId, selectPet, repository } = usePetData()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [summary, setSummary] = useState<MonthlySummary>({ totalCost: 0, entryCount: 0 })
  const [weights, setWeights] = useState<WeightEntry[]>([])
  const [petFormMode, setPetFormMode] = useState<'add' | 'edit' | null>(null)

  useEffect(() => {
    if (searchParams.get('addPet') === '1') setPetFormMode('add')
  }, [searchParams])

  const closePetForm = () => {
    setPetFormMode(null)
    if (searchParams.has('addPet')) setSearchParams({})
  }

  useEffect(() => {
    if (!currentPetId) return
    void Promise.all([
      repository.getMonthlySummary(currentPetId, '2026-06'),
      repository.listWeights(currentPetId),
    ]).then(([nextSummary, nextWeights]) => {
      setSummary(nextSummary)
      setWeights(nextWeights)
    })
  }, [currentPetId, repository])

  return (
    <div className="page home-page">
      <header className="page-header home-header">
        <div>
          <p className="eyebrow">PETPLANET · 灯火花园</p>
          <h1>今天也一起好好生活</h1>
          <p>把照顾它的每一件小事，慢慢收进时间里。</p>
        </div>
        <div className="header-actions">
          <button className="button secondary" onClick={() => navigate('/health')}>
            <FirstAidKit size={19} />记录病历
          </button>
          <button className="button primary" onClick={() => navigate('/memories')}>
            <Sparkle size={19} />添加回忆
          </button>
        </div>
      </header>

      <section aria-labelledby="pet-section-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">我的小家伙们</p>
            <h2 id="pet-section-title">宠物角色卡</h2>
          </div>
          <button className="text-button" onClick={() => setPetFormMode('add')}><Plus size={18} />添加宠物</button>
        </div>
        <div className="pet-card-row">
          {pets.map((pet) => (
            <button
              key={pet.id}
              className={`pet-card ${pet.id === currentPetId ? 'active' : ''}`}
              onClick={() => selectPet(pet.id)}
              aria-label={`选择${pet.name}`}
            >
              <div className="pet-card-top">
                <img src={pet.avatar} alt={pet.name} />
                <div>
                  <strong>{pet.name}</strong>
                  <span>{pet.breed} · {pet.ageLabel} · {pet.currentWeight}kg</span>
                </div>
                <i aria-hidden="true" />
              </div>
              <div className="pet-tags">
                <span>{pet.status}</span>
                <span>健康</span>
              </div>
              <div className="reminder-line">
                <span>下次提醒<strong>{pet.reminder}</strong></span>
                <b>{pet.reminderDate}</b>
              </div>
            </button>
          ))}
          <button className="pet-card add-pet-card" onClick={() => setPetFormMode('add')}>
            <Plus size={25} />
            <span>迎接新的家庭成员</span>
          </button>
        </div>
      </section>

      {currentPet && (
        <section className="overview-section" aria-labelledby="overview-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">本月陪伴</p>
              <h2 id="overview-title">{currentPet.name}的本月概览</h2>
            </div>
            <button className="soft-badge pet-manage" onClick={() => setPetFormMode('edit')}>管理资料</button>
          </div>
          <div className="overview-grid">
            <article className="metric-panel health-note">
              <span className="panel-kicker"><FirstAidKit size={19} />健康备忘</span>
              <h3>上周检查恢复良好，继续保持运动。</h3>
              <p>下一次复诊建议在 6 月 25 日前完成。</p>
            </article>
            <article className="metric-panel">
              <span className="panel-kicker"><TrendUp size={19} />体重趋势</span>
              <div className="metric-value">{weights.at(-1)?.weightKg ?? currentPet.currentWeight}<small>kg</small></div>
              <div className="mini-chart" aria-label="近月体重趋势">
                {weights.slice(-4).map((weight, index) => (
                  <i key={weight.id} style={{ height: `${34 + index * 7}%` }} />
                ))}
              </div>
            </article>
            <article className="metric-panel spending-panel">
              <span className="panel-kicker">本月支出</span>
              <div className="metric-value">¥{summary.totalCost}</div>
              <p>{summary.entryCount} 项生活记录 · 主粮与护理</p>
            </article>
            <button className="memory-preview" onClick={() => navigate('/memories')}>
              <img src="/assets/memory-sunlit-nap.jpg" alt="午后阳光下的午睡" />
              <span>最新回忆<strong>午后阳光下的午睡</strong></span>
            </button>
          </div>
          <div className="activity-strip">
            <div className="section-heading">
              <h3>最近活动</h3>
              <span>一家人的小日常</span>
            </div>
            <div className="activity-list">
              <div><i><Footprints size={18} /></i><span><b>{currentPet.name}</b> 完成了 30 分钟户外运动</span><time>2 小时前</time></div>
              <div><i><BowlFood size={18} /></i><span>给 <b>米粒</b> 喂食了冻干零食</span><time>今天 09:00</time></div>
              <div><i><TrendUp size={18} /></i><span><b>糖糖</b> 更新了体重记录</span><time>昨天</time></div>
            </div>
          </div>
        </section>
      )}
      {petFormMode && (
        <PetForm
          pet={petFormMode === 'edit' ? currentPet : undefined}
          onClose={closePetForm}
          onSaved={(pet) => {
            if (pet) selectPet(pet.id)
          }}
        />
      )}
    </div>
  )
}
