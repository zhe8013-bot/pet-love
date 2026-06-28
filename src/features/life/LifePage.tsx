import { Plus, Scales } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { usePetData } from '../../data/PetDataProvider'
import type { ConsumptionEntry, WeightEntry } from '../../domain/types'
import { ConsumptionForm } from './ConsumptionForm'
import { WeightForm } from './WeightForm'

export function LifePage() {
  const { currentPet, currentPetId, repository } = usePetData()
  const [entries, setEntries] = useState<ConsumptionEntry[]>([])
  const [weights, setWeights] = useState<WeightEntry[]>([])
  const [consumptionOpen, setConsumptionOpen] = useState(false)
  const [weightOpen, setWeightOpen] = useState(false)
  const [month, setMonth] = useState('2026-06')

  const loadEntries = () => {
    if (!currentPetId) return
    void Promise.all([
      repository.listConsumptions(currentPetId, month),
      repository.listWeights(currentPetId),
    ]).then(([nextEntries, nextWeights]) => {
      setEntries(nextEntries)
      setWeights(nextWeights)
    })
  }

  useEffect(loadEntries, [currentPetId, repository, month])

  const total = entries.reduce((sum, item) => sum + item.cost, 0)
  const changeMonth = (offset: number) => {
    const date = new Date(`${month}-01T00:00:00`)
    date.setMonth(date.getMonth() + offset)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{currentPet?.name ?? '宠物'} · MONTHLY CARE</p>
          <h1>生活记录</h1>
          <p>看见每个月的变化，照顾就会变得更从容。</p>
        </div>
        <div className="header-actions">
          <button className="button secondary" onClick={() => setWeightOpen(true)}><Scales size={19} />记录体重</button>
          <button className="button primary" onClick={() => setConsumptionOpen(true)}><Plus size={19} />记录消耗</button>
        </div>
      </header>

      <div className="month-switcher">
        <button onClick={() => changeMonth(-1)}>上个月</button>
        <strong>{month.slice(0, 4)} 年 {Number(month.slice(5))} 月</strong>
        <button onClick={() => changeMonth(1)}>下个月</button>
      </div>

      <section className="life-grid">
        <article className="metric-panel life-summary">
          <span className="panel-kicker">本月照护支出</span>
          <div className="metric-value">¥{total}</div>
          <p>{entries.length} 项记录，最近更新于 6 月 22 日</p>
        </article>
        <article className="metric-panel weight-chart-panel">
          <div className="chart-heading"><span className="panel-kicker">体重趋势</span><strong>{weights.at(-1)?.weightKg ?? '--'}kg</strong></div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={weights}>
              <XAxis dataKey="measuredAt" tickFormatter={(value) => value.slice(5)} axisLine={false} tickLine={false} />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
              <Tooltip />
              <Line type="monotone" dataKey="weightKg" stroke="#e88f78" strokeWidth={3} dot={{ fill: '#e88f78', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </article>
      </section>

      <section className="record-table" aria-labelledby="consumption-title">
        <div className="section-heading"><h2 id="consumption-title">本月消耗</h2><span>用量与花费</span></div>
        {entries.map((entry) => (
          <div className="record-row" key={entry.id}>
            <strong>{entry.category}</strong>
            <span>{entry.quantity} {entry.unit}</span>
            <b>¥{entry.cost}</b>
            <button onClick={async () => { await repository.removeConsumption(entry.id); loadEntries() }}>删除</button>
          </div>
        ))}
      </section>
      {consumptionOpen && <ConsumptionForm month={month} onClose={() => setConsumptionOpen(false)} onSaved={loadEntries} />}
      {weightOpen && <WeightForm onClose={() => setWeightOpen(false)} onSaved={loadEntries} />}
    </div>
  )
}
