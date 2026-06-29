import { WarningCircle } from '@phosphor-icons/react'
import { Modal } from './Modal'

export function ConfirmDialog({
  title,
  description,
  confirmLabel = '确认删除',
  pending = false,
  error = '',
  onCancel,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel?: string
  pending?: boolean
  error?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="confirm-dialog">
        <WarningCircle size={36} weight="duotone" />
        <p>{description}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="form-actions">
          <button type="button" className="button ghost" onClick={onCancel} disabled={pending}>取消</button>
          <button type="button" className="button danger" onClick={onConfirm} disabled={pending}>
            {pending ? '正在删除…' : confirmLabel}
          </button>
        </footer>
      </div>
    </Modal>
  )
}
