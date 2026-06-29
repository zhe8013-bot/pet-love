import { useState, type FormEvent } from 'react'
import { FormField } from '../../components/FormField'
import { Modal } from '../../components/Modal'
import { usePetData } from '../../data/PetDataProvider'

export function WeightForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { currentPetId, repository, refreshPets } = usePetData()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const weightKg = Number(form.get('weightKg'))
    const measuredAt = String(form.get('measuredAt') ?? '')
    if (!measuredAt || !Number.isFinite(weightKg) || weightKg <= 0) {
      setError('请填写正确的日期与体重')
      return
    }
    setPending(true)
    setError('')
    try {
      await repository.addWeight({ petId: currentPetId, measuredAt, weightKg })
      await refreshPets()
      onSaved()
      onClose()
    } catch {
      setError('体重没有保存成功，请稍后重试。')
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal title="记录体重" onClose={onClose}>
      <form className="record-form" onSubmit={submit}>
        <div className="form-grid two">
          <FormField label="测量日期" name="measuredAt" type="date" required />
          <FormField label="体重（kg）" name="weightKg" type="number" min="0.1" step="0.1" required />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="button ghost" onClick={onClose} disabled={pending}>取消</button>
          <button className="button primary" type="submit" disabled={pending}>{pending ? '正在保存…' : '保存体重'}</button>
        </footer>
      </form>
    </Modal>
  )
}
