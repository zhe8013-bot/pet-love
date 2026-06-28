import { useState, type FormEvent } from 'react'
import { FormField, TextAreaField } from '../../components/FormField'
import { Modal } from '../../components/Modal'
import { usePetData } from '../../data/PetDataProvider'
import type { Memory, Mood } from '../../domain/types'
import { filesToDataUrls } from '../../lib/files'

const moods: Mood[] = ['开心', '安心', '调皮', '困困', '恢复中']

export function MemoryForm({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (memory: Memory) => void
}) {
  const { currentPetId, repository } = usePetData()
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const occurredAt = String(form.get('occurredAt') ?? '')
    const note = String(form.get('note') ?? '').trim()
    if (!occurredAt || !note) {
      setError('请留下日期和这一刻的故事')
      return
    }
    const selectedFiles = (form.getAll('photos') as File[]).filter((file) => file.size > 0)
    const photos = selectedFiles.length
      ? await filesToDataUrls(selectedFiles)
      : ['/assets/memory-sunlit-nap.jpg']
    const memory = await repository.addMemory({
      petId: currentPetId,
      occurredAt,
      mood: String(form.get('mood')) as Mood,
      note,
      photos,
      isHighlight: form.get('isHighlight') === 'on',
    })
    onSaved(memory)
    onClose()
  }

  return (
    <Modal title="添加回忆" onClose={onClose}>
      <form className="record-form" onSubmit={submit}>
        <div className="form-grid two">
          <FormField label="日期" name="occurredAt" type="date" required />
          <label className="form-field">
            <span>心情</span>
            <select name="mood" defaultValue="开心">
              {moods.map((mood) => <option key={mood}>{mood}</option>)}
            </select>
          </label>
        </div>
        <TextAreaField label="留言" name="note" placeholder="这一刻发生了什么？" required />
        <FormField label="照片" hint="JPG、PNG、WebP" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple />
        <label className="check-field"><input name="isHighlight" type="checkbox" />标记为闪光回忆</label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="button ghost" onClick={onClose}>取消</button>
          <button className="button primary" type="submit">保存回忆</button>
        </footer>
      </form>
    </Modal>
  )
}
