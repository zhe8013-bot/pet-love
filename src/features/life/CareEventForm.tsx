import { useState, type FormEvent } from 'react'
import { FormField } from '../../components/FormField'
import { Modal } from '../../components/Modal'
import { usePetData } from '../../data/PetDataProvider'
import type { CareEvent, CareEventKind } from '../../domain/types'

const copy = {
  feeding: { title: '记录喂食', amountLabel: '数量（g）', unit: 'g' as const, action: '保存喂食' },
  water: { title: '记录饮水', amountLabel: '数量（ml）', unit: 'ml' as const, action: '保存饮水' },
}

export function CareEventForm({
  kind,
  onClose,
  onSaved,
}: {
  kind: CareEventKind
  onClose: () => void
  onSaved: (event: CareEvent) => void
}) {
  const { currentPetId, repository } = usePetData()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const content = copy[kind]

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const occurredAt = String(form.get('occurredAt') ?? '')
    const amount = Number(form.get('amount'))

    if (!occurredAt || !Number.isFinite(amount) || amount <= 0) {
      setError(`请填写发生时间和有效的${content.amountLabel}`)
      return
    }

    setPending(true)
    setError('')
    try {
      const saved = await repository.addCareEvent({
        petId: currentPetId,
        kind,
        occurredAt,
        amount,
        unit: content.unit,
      })
      onSaved(saved)
      onClose()
    } catch {
      setError('照护记录没有保存成功，请稍后重试。')
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal title={content.title} onClose={onClose}>
      <form className="record-form" onSubmit={submit}>
        <div className="form-grid two">
          <FormField label="发生时间" name="occurredAt" type="datetime-local" />
          <FormField label={content.amountLabel} name="amount" type="number" min="0.1" step="0.1" />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="button ghost" onClick={onClose} disabled={pending}>取消</button>
          <button className="button primary" type="submit" disabled={pending}>{pending ? '正在保存…' : content.action}</button>
        </footer>
      </form>
    </Modal>
  )
}
