import { X } from '@phosphor-icons/react'
import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const titleId = `modal-${title.replaceAll(' ', '-')}`

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header>
          <div><span className="eyebrow">PETPLANET RECORD</span><h2 id={titleId}>{title}</h2></div>
          <button className="icon-button" aria-label="关闭" onClick={onClose}><X size={21} /></button>
        </header>
        {children}
      </section>
    </div>
  )
}
