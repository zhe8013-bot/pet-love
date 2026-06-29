import { Trash } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FormField } from '../../components/FormField'
import { Modal } from '../../components/Modal'
import { usePetData } from '../../data/PetDataProvider'
import type { Pet, PetSpecies } from '../../domain/types'

const ageLabelFromBirthDate = (birthDate: string) => {
  const born = new Date(`${birthDate}T00:00:00`)
  const today = new Date()
  let years = today.getFullYear() - born.getFullYear()
  const beforeBirthday =
    today.getMonth() < born.getMonth() ||
    (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())
  if (beforeBirthday) years -= 1
  return years > 0 ? `${years}岁` : '不到1岁'
}

export function PetForm({
  pet,
  onClose,
  onSaved,
}: {
  pet?: Pet
  onClose: () => void
  onSaved: (pet?: Pet) => void
}) {
  const { repository, refreshPets } = usePetData()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const birthDate = String(form.get('birthDate') ?? '')
    const currentWeight = Number(form.get('currentWeight'))
    if (!name || !birthDate || currentWeight <= 0) {
      setError('请填写名字、生日和正确的体重')
      return
    }
    setPending(true)
    setError('')
    try {
      const avatarFiles = (form.getAll('avatar') as File[]).filter((file) => file.size > 0)
      const species = String(form.get('species')) as PetSpecies
      const fallbackAvatar = pet?.avatar ?? (species === 'cat' ? '/assets/cat-avatar.jpg' : '/assets/dog-avatar.jpg')
      const input = {
        name,
        species,
        breed: String(form.get('breed') ?? '').trim() || '等待填写品种',
        birthDate,
        ageLabel: ageLabelFromBirthDate(birthDate),
        currentWeight,
        status: String(form.get('status') ?? '').trim() || '健康',
        avatar: fallbackAvatar,
        reminder: pet?.reminder ?? '建立第一条记录',
        reminderDate: pet?.reminderDate ?? '今天',
      }
      let saved = pet
        ? await repository.updatePet(pet.id, input)
        : await repository.addPet(input)
      if (!pet || pet.currentWeight !== currentWeight) {
        await repository.addWeight({
          petId: saved.id,
          measuredAt: new Date().toISOString().slice(0, 10),
          weightKg: currentWeight,
        })
      }
      if (avatarFiles.length > 0) {
        const [avatar] = await repository.uploadAssets(avatarFiles, saved.id, 'avatar')
        if (avatar) saved = await repository.updatePet(saved.id, { avatar })
      }
      await refreshPets()
      onSaved(saved)
      onClose()
    } catch {
      setError('宠物资料没有保存成功，请检查图片后重试。')
    } finally {
      setPending(false)
    }
  }

  const remove = async () => {
    if (!pet) return
    setPending(true)
    setError('')
    try {
      await repository.removePet(pet.id)
      await refreshPets()
      onSaved()
      onClose()
    } catch {
      setError('暂时无法删除，请稍后重试。')
      setConfirmingDelete(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal title={pet ? '编辑宠物资料' : '添加宠物'} onClose={onClose}>
      <form className="record-form" onSubmit={submit}>
        <div className="form-grid two">
          <FormField label="名字" name="name" defaultValue={pet?.name} required />
          <label className="form-field">
            <span>宠物类型</span>
            <select name="species" defaultValue={pet?.species ?? 'dog'}>
              <option value="dog">狗狗</option>
              <option value="cat">猫咪</option>
              <option value="other">其他</option>
            </select>
          </label>
          <FormField label="品种" name="breed" defaultValue={pet?.breed} required />
          <FormField label="生日" name="birthDate" type="date" defaultValue={pet?.birthDate} required />
          <FormField label="当前体重（kg）" name="currentWeight" type="number" min="0.1" step="0.1" defaultValue={pet?.currentWeight} required />
          <FormField label="当前状态" name="status" defaultValue={pet?.status ?? '健康'} />
        </div>
        <FormField label="头像" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" />
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="form-actions spread">
          <div>{pet && <button type="button" className="danger-button" onClick={() => setConfirmingDelete(true)} disabled={pending}><Trash size={17} />删除宠物</button>}</div>
          <div>
            <button type="button" className="button ghost" onClick={onClose} disabled={pending}>取消</button>
            <button className="button primary" type="submit" disabled={pending}>{pending ? '正在保存…' : '保存宠物'}</button>
          </div>
        </footer>
      </form>
      {confirmingDelete && pet && <ConfirmDialog title={`删除${pet.name}？`} description="这会同时删除它的病历、生活和体重记录，且无法恢复。" pending={pending} onCancel={() => setConfirmingDelete(false)} onConfirm={() => void remove()} />}
    </Modal>
  )
}
