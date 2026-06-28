import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { FormField, TextAreaField } from '../../components/FormField'
import { Modal } from '../../components/Modal'
import { usePetData } from '../../data/PetDataProvider'
import { filesToDataUrls } from '../../lib/files'

const schema = z.object({
  visitDate: z.string().min(1, '请选择就诊日期'),
  symptoms: z.string().min(2, '请描述症状'),
  diagnosis: z.string().min(2, '请填写诊断'),
  treatment: z.string().min(2, '请填写治疗方案'),
})

export function MedicalRecordForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { currentPetId, repository } = usePetData()
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const input = {
      visitDate: String(form.get('visitDate') ?? ''),
      symptoms: String(form.get('symptoms') ?? ''),
      diagnosis: String(form.get('diagnosis') ?? ''),
      treatment: String(form.get('treatment') ?? ''),
    }
    const validation = schema.safeParse(input)
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? '请检查填写内容')
      return
    }
    const photos = await filesToDataUrls((form.getAll('photos') as File[]).filter((file) => file.size > 0))
    await repository.addMedicalRecord({
      petId: currentPetId,
      ...validation.data,
      medication: String(form.get('medication') ?? ''),
      clinic: String(form.get('clinic') ?? ''),
      cost: Number(form.get('cost') || 0),
      followUpDate: String(form.get('followUpDate') ?? ''),
      photos,
      status: form.get('followUpDate') ? 'follow-up' : 'ongoing',
    })
    onSaved()
    onClose()
  }

  return (
    <Modal title="新增病历" onClose={onClose}>
      <form className="record-form" onSubmit={submit}>
        <div className="form-grid two">
          <FormField label="就诊日期" name="visitDate" type="date" required />
          <FormField label="医院" name="clinic" placeholder="例如：暖爪动物医院" />
        </div>
        <TextAreaField label="症状" name="symptoms" placeholder="它哪里不舒服？精神和食欲如何？" required />
        <TextAreaField label="诊断" name="diagnosis" placeholder="医生给出的诊断" required />
        <TextAreaField label="治疗方案" name="treatment" placeholder="治疗、护理和注意事项" required />
        <div className="form-grid two">
          <FormField label="用药" name="medication" placeholder="药品与频次" />
          <FormField label="费用" name="cost" type="number" min="0" step="0.01" placeholder="0" />
          <FormField label="复诊日期" name="followUpDate" type="date" />
          <FormField label="病历照片" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="button ghost" onClick={onClose}>取消</button>
          <button className="button primary" type="submit">保存病历</button>
        </footer>
      </form>
    </Modal>
  )
}
