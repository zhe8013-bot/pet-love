import { useRef, useState, type FormEvent } from 'react'
import { FormField, TextAreaField } from '../../components/FormField'
import { Modal } from '../../components/Modal'
import { usePetData } from '../../data/PetDataProvider'
import type { Memory } from '../../domain/types'

export function LifePhotoForm({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (memory: Memory) => void
}) {
  const { currentPetId, repository } = usePetData()
  const photoInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const occurredAt = String(form.get('occurredAt') ?? '')
    const note = String(form.get('note') ?? '').trim()
    const files = Array.from(photoInput.current?.files ?? []).filter((file) => file.size > 0)

    if (!occurredAt || files.length === 0) {
      setError('请选择拍摄时间和至少一张照片')
      return
    }

    setPending(true)
    setError('')
    try {
      const photos = await repository.uploadAssets(files, currentPetId, 'memory')
      const memory = await repository.addMemory({
        petId: currentPetId,
        occurredAt,
        mood: '安心',
        note: note || '今天的生活照片',
        photos,
        isHighlight: false,
      })
      onSaved(memory)
      onClose()
    } catch {
      setError('照片没有保存成功，请稍后重试。')
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal title="添加生活照片" onClose={onClose}>
      <form className="record-form" onSubmit={submit}>
        <FormField label="拍摄时间" name="occurredAt" type="datetime-local" />
        <TextAreaField label="一句话说明" name="note" placeholder="例如：草地上玩到舍不得回家" />
        <label className="form-field">
          <span>照片</span>
          <input ref={photoInput} name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="button ghost" onClick={onClose} disabled={pending}>取消</button>
          <button className="button primary" type="submit" disabled={pending}>{pending ? '正在保存…' : '保存照片'}</button>
        </footer>
      </form>
    </Modal>
  )
}
