import {
  CaretLeft,
  CaretRight,
  ChartLineUp,
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
import type { ConsumptionEntry, WeightEntry } from '../../domain/types'
import { ConsumptionForm } from './ConsumptionForm'
import { WeightForm } from './WeightForm'

type DeleteTarget = { kind: 'consumption'; item: ConsumptionEntry } | { kind: 'weight'; item: WeightEntry }

const nowMonth = () => new Date().toISOString().slice(0, 7)

export function LifePage() {
  const { currentPet, currentPetId, repository, refreshPets } = usePetData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [entries, setEntries] = useState<ConsumptionEntry[]>([])
  const [weights, setWeights] = useState<WeightEntry[]>([])
  const [consumptionOpen, setConsumptionOpen] = useState(false)
  const [weightOpen, setWeightOpen] = useState(false)
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
      const [nextEntries, nextWeights] = await Promise.all([
        repository.listConsumptions(currentPetId, month),
        repository.listWeights(currentPetId),
      ])
      setEntries(nextEntries)
      setWeights(nextWeights)
    } catch {
      setLoadError('生活记录暂时没有加载成功，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }, [currentPetId, month, repository])

  useEffect(() => { void loadEntries() }, [loadEntries])
  useEffect(() => {
    const next = searchParams.get('new')
    if (next === 'consumption') setConsumptionOpen(true)
    if (next === 'weight') setWeightOpen(true)
  }, [searchParams])

  const total = entries.reduce((sum, item) => sum + item.cost, 0)
  const categories = useMemo(() => ['全部', ...Array.from(new Set(entries.map((item) => item.category)))], [entries])
  const visibleEntries = category === '全部' ? entries : entries.filter((item) => item.category === category)
  const latestWeight = weights.at(-1)
  const previousWeight = weights.at(-2)
  const weightChange = latestWeight && previousWeight ? latestWeight.weightKg - previousWeight.weightKg : 0

  const changeMonth = (offset: number) => {
    const date = new Date(`${month}-01T00:00:00`)
    date.setMonth(date.getMonth() + offset)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    setCategory('全部')
  }

  const closeComposer = () => {
    setConsumptionOpen(false)
    setWeightOpen(false)
    if (searchParams.has('new')) setSearchParams({}, { replace: true })
  }

  const removeTarget = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      if (deleteTarget.kind === 'consumption') await repository.removeConsumption(deleteTarget.item.id)
      else {
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

  return (
    <div className="page life-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{currentPet?.name ?? '宠物'} · MONTHLY CARE</p>
          <h1>生活记录</h1>
          <p>按月查看消耗、花费和体重变化，让照护更有把握。</p>
        </div>
        <div className="header-actions">
          <button className="button secondary" onClick={() => setWeightOpen(true)}><Scales size={19} />记录体重</button>
          <button className="button primary" onClick={() => setConsumptionOpen(true)}><Plus size={19} />记录消耗</button>
        </div>
      </header>

      <div className="month-switcher">
        <button aria-label="上个月" onClick={() => changeMonth(-1)}><CaretLeft size={18} /></button>
        <strong>{month.slice(0, 4)} 年 {Number(month.slice(5))} 月</strong>
        <button aria-label="下个月" onClick={() => changeMonth(1)}><CaretRight size={18} /></button>
      </div>

      {loading ? (
        <div className="content-state" aria-live="polite"><span className="loading-dot" />正在汇总本月记录…</div>
      ) : loadError ? (
        <div className="content-state error-state" role="alert"><p>{loadError}</p><button className="button secondary" onClick={() => void loadEntries()}>重新加载</button></div>
      ) : (
        <>
          <section className="life-metrics" aria-label="本月概览">
            <article><span><ShoppingBagOpen size={21} />本月花费</span><strong>¥{total}</strong><small>{entries.length} 条消费记录</small></article>
            <article><span><ChartLineUp size={21} />照护类别</span><strong>{categories.length - 1}</strong><small>{entries.length > 0 ? entries.slice(0, 3).map((item) => item.category).join('、') : '本月尚无记录'}</small></article>
            <article><span><Scales size={21} />当前体重</span><strong>{latestWeight?.weightKg ?? '--'}<em>kg</em></strong><small>{weightChange === 0 ? '较上次持平' : `较上次 ${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg`}</small></article>
          </section>

          <section className="weight-chart-panel metric-panel">
            <div className="chart-heading"><div><span className="panel-kicker">体重趋势</span><p>最近 {Math.min(weights.length, 8)} 次测量</p></div><strong>{latestWeight?.weightKg ?? '--'}kg</strong></div>
            {weights.length > 0 ? (
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={weights.slice(-8)} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <XAxis dataKey="measuredAt" tickFormatter={(value) => value.slice(5)} axisLine={false} tickLine={false} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                  <Tooltip formatter={(value) => [`${value} kg`, '体重']} labelFormatter={(value) => `测量日期 ${value}`} />
                  <Line type="monotone" dataKey="weightKg" stroke="#e88f78" strokeWidth={3} dot={{ fill: '#fff9f3', stroke: '#e88f78', strokeWidth: 3, r: 5 }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="empty-state compact">还没有体重记录。</div>}
            {weights.length > 0 && <div className="weight-log">{weights.slice(-4).reverse().map((weight) => <div key={weight.id}><span>{weight.measuredAt}</span><strong>{weight.weightKg} kg</strong><button aria-label={`删除${weight.measuredAt}体重记录`} onClick={() => { setDeleteError(''); setDeleteTarget({ kind: 'weight', item: weight }) }}><Trash size={16} /></button></div>)}</div>}
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
        </>
      )}

      {deleteTarget && <ConfirmDialog title={deleteTarget.kind === 'consumption' ? '删除这条消耗记录？' : '删除这条体重记录？'} description="删除后无法恢复，统计数据会立即重新计算。" pending={deleting} error={deleteError} onCancel={() => setDeleteTarget(null)} onConfirm={() => void removeTarget()} />}
      {consumptionOpen && <ConsumptionForm month={month} onClose={closeComposer} onSaved={() => void loadEntries()} />}
      {weightOpen && <WeightForm onClose={closeComposer} onSaved={() => void loadEntries()} />}
    </div>
  )
}
