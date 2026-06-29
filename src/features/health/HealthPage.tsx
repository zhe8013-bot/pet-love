import {
  CalendarBlank,
  FirstAidKit,
  ImageSquare,
  MagnifyingGlass,
  Plus,
  Trash,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Modal } from '../../components/Modal'
import { usePetData } from '../../data/PetDataProvider'
import type { MedicalRecord, MedicalStatus } from '../../domain/types'
import { MedicalRecordForm } from './MedicalRecordForm'

type StatusFilter = 'all' | MedicalStatus
type TimeFilter = 'all' | 'six-months' | 'year'

const statusLabels: Record<MedicalStatus, string> = {
  ongoing: '治疗中',
  recovered: '已恢复',
  'follow-up': '待复诊',
}

export function HealthPage() {
  const { currentPet, currentPetId, repository } = usePetData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState<MedicalRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MedicalRecord | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadRecords = useCallback(async () => {
    if (!currentPetId) return
    setLoading(true)
    setLoadError('')
    try {
      setRecords(await repository.listMedicalRecords(currentPetId))
    } catch {
      setLoadError('病历暂时没有加载成功，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }, [currentPetId, repository])

  useEffect(() => { void loadRecords() }, [loadRecords])
  useEffect(() => {
    if (searchParams.get('new') === '1') setFormOpen(true)
  }, [searchParams])

  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const now = Date.now()
    const timeWindow = timeFilter === 'six-months' ? 183 : timeFilter === 'year' ? 366 : Number.POSITIVE_INFINITY
    return records.filter((record) => {
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const ageInDays = (now - new Date(`${record.visitDate}T00:00:00`).getTime()) / 86_400_000
      const matchesTime = ageInDays <= timeWindow
      const haystack = [record.diagnosis, record.symptoms, record.treatment, record.medication, record.clinic].join(' ').toLowerCase()
      return matchesStatus && matchesTime && (!normalized || haystack.includes(normalized))
    })
  }, [query, records, statusFilter, timeFilter])

  const closeForm = () => {
    setFormOpen(false)
    if (searchParams.has('new')) setSearchParams({}, { replace: true })
  }

  const removeRecord = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await repository.removeMedicalRecord(deleteTarget.id)
      setSelected(null)
      setDeleteTarget(null)
      await loadRecords()
    } catch {
      setDeleteError('删除没有完成，请稍后重试。')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="page health-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{currentPet?.name ?? '宠物'} · HEALTH JOURNAL</p>
          <h1>健康档案</h1>
          <p>把每一次症状、诊断和治疗留在同一条时间线上。</p>
        </div>
        <button className="button primary" onClick={() => setFormOpen(true)}><Plus size={19} />新增病历</button>
      </header>

      <section className="health-summary-strip" aria-label="健康概览">
        <div><FirstAidKit size={22} /><span>全部病历<strong>{records.length}</strong></span></div>
        <div><CalendarBlank size={22} /><span>待复诊<strong>{records.filter((item) => item.status === 'follow-up').length}</strong></span></div>
        <div><ImageSquare size={22} /><span>含照片<strong>{records.filter((item) => item.photos.length > 0).length}</strong></span></div>
      </section>

      <section className="filter-panel" aria-label="病历筛选">
        <label className="search-field">
          <MagnifyingGlass size={18} />
          <input type="search" aria-label="搜索病历" placeholder="搜索诊断、症状、医院…" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="filter-row status-filters">
          {([
            ['all', '全部'],
            ['follow-up', '待复诊'],
            ['ongoing', '治疗中'],
            ['recovered', '已恢复'],
          ] as const).map(([value, label]) => (
            <button key={value} className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)}>{label}</button>
          ))}
        </div>
        <label className="time-filter">
          <span>时间范围</span>
          <select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}>
            <option value="all">全部时间</option>
            <option value="six-months">近 6 个月</option>
            <option value="year">近 1 年</option>
          </select>
        </label>
      </section>

      {loading ? (
        <div className="content-state" aria-live="polite"><span className="loading-dot" />正在整理健康档案…</div>
      ) : loadError ? (
        <div className="content-state error-state" role="alert"><p>{loadError}</p><button className="button secondary" onClick={() => void loadRecords()}>重新加载</button></div>
      ) : (
        <section className="timeline-list" aria-label="病历时间线">
          {filteredRecords.map((record) => (
            <article key={record.id} className="timeline-item">
              <time>{record.visitDate}</time>
              <div className="timeline-dot" />
              <button className="timeline-content" aria-label={`查看${record.diagnosis}详情`} onClick={() => setSelected(record)}>
                <div className="timeline-title">
                  <div><span className={`record-status ${record.status}`}>{statusLabels[record.status]}</span><h2>{record.diagnosis}</h2></div>
                  <strong>¥{record.cost}</strong>
                </div>
                <p>{record.symptoms}</p>
                <dl>
                  <div><dt>治疗</dt><dd>{record.treatment}</dd></div>
                  <div><dt>用药</dt><dd>{record.medication || '无需用药'}</dd></div>
                  <div><dt>医院</dt><dd>{record.clinic || '未填写'}</dd></div>
                </dl>
                {record.photos.length > 0 && <div className="timeline-photos">{record.photos.slice(0, 3).map((photo) => <img key={photo} src={photo} alt={`${record.diagnosis}病历缩略图`} />)}</div>}
                <footer><span>{record.photos.length > 0 ? `${record.photos.length} 张照片` : '无照片'}</span><b>查看详情</b></footer>
              </button>
            </article>
          ))}
          {filteredRecords.length === 0 && <div className="empty-state"><FirstAidKit size={34} weight="duotone" /><h2>没有找到符合条件的病历</h2><p>换个筛选条件，或为{currentPet?.name ?? '宠物'}新增一条健康记录。</p><button className="button primary" onClick={() => setFormOpen(true)}>新增病历</button></div>}
        </section>
      )}

      {selected && (
        <Modal title="病历详情" onClose={() => setSelected(null)}>
          <article className="medical-detail">
            <div className="medical-detail-heading"><span className={`record-status ${selected.status}`}>{statusLabels[selected.status]}</span><time>{selected.visitDate}</time></div>
            <h3>{selected.diagnosis}</h3>
            <dl>
              <div><dt>症状</dt><dd>{selected.symptoms}</dd></div>
              <div><dt>治疗方案</dt><dd>{selected.treatment}</dd></div>
              <div><dt>用药</dt><dd>{selected.medication || '无需用药'}</dd></div>
              <div><dt>就诊医院</dt><dd>{selected.clinic || '未填写'}</dd></div>
              <div><dt>本次费用</dt><dd>¥{selected.cost}</dd></div>
              <div><dt>复诊日期</dt><dd>{selected.followUpDate || '无需复诊'}</dd></div>
            </dl>
            {selected.photos.length > 0 && <div className="medical-photos">{selected.photos.map((photo) => <img key={photo} src={photo} alt={`${selected.diagnosis}病历照片`} />)}</div>}
            <footer className="detail-actions"><button className="danger-button" onClick={() => { setDeleteError(''); setDeleteTarget(selected) }}><Trash size={17} />删除病历</button><button className="button primary" onClick={() => setSelected(null)}>完成</button></footer>
          </article>
        </Modal>
      )}
      {deleteTarget && <ConfirmDialog title="删除这条病历？" description="删除后无法恢复，相关照片也会解除关联。" pending={deleting} error={deleteError} onCancel={() => setDeleteTarget(null)} onConfirm={() => void removeRecord()} />}
      {formOpen && <MedicalRecordForm onClose={closeForm} onSaved={() => void loadRecords()} />}
    </div>
  )
}
