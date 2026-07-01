import { useState, type FormEvent } from 'react'
import { FormField, TextAreaField } from '../../components/FormField'
import { Modal } from '../../components/Modal'
import type { CustomTodo } from './reminderModel'

export function TodoForm({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (todo: CustomTodo) => void
}) {
  const [error, setError] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    const description = String(form.get('description') ?? '').trim()
    const dueAt = String(form.get('dueAt') ?? '')

    if (!title || !dueAt) {
      setError('请填写待办事项和截至时间')
      return
    }

    onSaved({
      id: `todo-${Date.now()}`,
      title,
      description,
      dueAt,
    })
    onClose()
  }

  return (
    <Modal title="添加待办" onClose={onClose}>
      <form className="record-form todo-form" onSubmit={submit}>
        <FormField
          aria-required="true"
          autoFocus
          label="待办事项"
          name="title"
          placeholder="例如：补充益生菌"
        />
        <TextAreaField
          label="描述"
          name="description"
          placeholder="补充一些照顾细节"
        />
        <FormField
          aria-required="true"
          label="截至时间"
          name="dueAt"
          type="datetime-local"
        />
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="button ghost" onClick={onClose}>取消</button>
          <button className="button primary" type="submit">保存待办</button>
        </footer>
      </form>
    </Modal>
  )
}
