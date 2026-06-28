import { Trash } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import { FormField } from '../../components/FormField'
import { Modal } from '../../components/Modal'
import { usePetData } from '../../data/PetDataProvider'
import type { Pet, PetSpecies } from '../../domain/types'
import { filesToDataUrls } from '../../lib/files'

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
    const avatarFiles = (form.getAll('avatar') as File[]).filter((file) => file.size > 0)
    const species = String(form.get('species')) as PetSpecies
    const avatar = avatarFiles[0]
      ? (await filesToDataUrls(avatarFiles))[0]
      : pet?.avatar ?? (species === 'cat' ? '/assets/cat-avatar.jpg' : '/assets/dog-avatar.jpg')
    const input = {
      name,
      species,
      breed: String(form.get('breed') ?? '').trim() || '等待填写品种',
      birthDate,
      ageLabel: ageLabelFromBirthDate(birthDate),
      currentWeight,
      status: String(form.get('status') ?? '').trim() || '健康',
      avatar,
      reminder: pet?.reminder ?? '建立第一条记录',
      reminderDate: pet?.reminderDate ?? '今天',
    }
    const saved = pet
      ? await repository.updatePet(pet.id, input)
      : await repository.addPet(input)
    await refreshPets()
    onSaved(saved)
    onClose()
  }

  const remove = async () => {
    if (!pet || !window.confirm(`确定删除${pet.name}及其全部记录吗？`)) return
    await repository.removePet(pet.id)
    await refreshPets()
    onSaved()
    onClose()
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
          <div>{pet && <button type="button" className="danger-button" onClick={remove}><Trash size={17} />删除宠物</button>}</div>
          <div>
            <button type="button" className="button ghost" onClick={onClose}>取消</button>
            <button className="button primary" type="submit">保存宠物</button>
          </div>
        </footer>
      </form>
    </Modal>
  )
}
