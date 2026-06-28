import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

interface BaseProps {
  label: string
  hint?: ReactNode
}

export function FormField({ label, hint, ...props }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="form-field">
      <span>{label}{hint && <small>{hint}</small>}</span>
      <input {...props} />
    </label>
  )
}

export function TextAreaField({ label, hint, ...props }: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="form-field">
      <span>{label}{hint && <small>{hint}</small>}</span>
      <textarea {...props} />
    </label>
  )
}
