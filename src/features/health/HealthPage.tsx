import { Plus } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { usePetData } from '../../data/PetDataProvider'
import type { MedicalRecord } from '../../domain/types'
import { MedicalRecordForm } from './MedicalRecordForm'

export function HealthPage() {
  const { currentPet, currentPetId, repository } = usePetData()
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'follow-up' | 'recovered'>('all')

  const loadRecords = () => {
    if (!currentPetId) return
    void repository.listMedicalRecords(currentPetId).then(setRecords)
  }

  useEffect(loadRecords, [currentPetId, repository])

  const statusLabels: Record<MedicalRecord['status'], string> = {
    ongoing: '治疗中',
    recovered: '已恢复',
    'follow-up': '待复诊',
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{currentPet?.name ?? '宠物'} · HEALTH JOURNAL</p>
          <h1>健康档案</h1>
          <p>每一次不舒服，都有迹可循，也有被认真照顾的证明。</p>
        </div>
        <button className="button primary" onClick={() => setFormOpen(true)}><Plus size={19} />新增病历</button>
      </header>
      <div className="filter-row">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部记录</button>
        <button className={filter === 'follow-up' ? 'active' : ''} onClick={() => setFilter('follow-up')}>待复诊</button>
        <button className={filter === 'recovered' ? 'active' : ''} onClick={() => setFilter('recovered')}>已恢复</button>
      </div>
      <section className="timeline-list">
        {records.filter((record) => filter === 'all' || record.status === filter).map((record) => (
          <article key={record.id} className="timeline-item">
            <time>{record.visitDate}</time>
            <div className="timeline-dot" />
            <div className="timeline-content">
              <div className="timeline-title">
                <div><span>{statusLabels[record.status]}</span><h2>{record.diagnosis}</h2></div>
                <strong>¥{record.cost}</strong>
              </div>
              <p>{record.symptoms}</p>
              <dl>
                <div><dt>治疗</dt><dd>{record.treatment}</dd></div>
                <div><dt>用药</dt><dd>{record.medication || '无需用药'}</dd></div>
                <div><dt>医院</dt><dd>{record.clinic}</dd></div>
              </dl>
            </div>
          </article>
        ))}
        {records.filter((record) => filter === 'all' || record.status === filter).length === 0 && <div className="empty-state">这个分类下还没有记录。</div>}
      </section>
      {formOpen && <MedicalRecordForm onClose={() => setFormOpen(false)} onSaved={loadRecords} />}
    </div>
  )
}
