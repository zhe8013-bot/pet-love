import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { FormField } from '../../components/FormField'
import { Modal } from '../../components/Modal'
import { usePetData } from '../../data/PetDataProvider'

const schema = z.object({
  category: z.string().min(1, '请填写类别'),
  quantity: z.number().positive('数量必须大于 0'),
  unit: z.string().min(1, '请填写单位'),
  cost: z.number().min(0, '花费不能小于 0'),
})

export function ConsumptionForm({ month, onClose, onSaved }: { month: string; onClose: () => void; onSaved: () => void }) {
  const { currentPetId, repository } = usePetData()
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const result = schema.safeParse({
      category: String(form.get('category') ?? ''),
      quantity: Number(form.get('quantity')),
      unit: String(form.get('unit') ?? ''),
      cost: Number(form.get('cost')),
    })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '请检查填写内容')
      return
    }
    await repository.addConsumption({ petId: currentPetId, month, ...result.data })
    onSaved()
    onClose()
  }

  return (
    <Modal title="记录消耗" onClose={onClose}>
      <form className="record-form" onSubmit={submit}>
        <FormField label="类别" name="category" defaultValue="主粮" />
        <div className="form-grid three">
          <FormField label="数量" name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" />
          <FormField label="单位" name="unit" defaultValue="kg" />
          <FormField label="花费" name="cost" type="number" min="0" step="0.01" defaultValue="0" />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="button ghost" onClick={onClose}>取消</button>
          <button className="button primary" type="submit">保存记录</button>
        </footer>
      </form>
    </Modal>
  )
}
