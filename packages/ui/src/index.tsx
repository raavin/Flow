import type {
  ButtonHTMLAttributes,
  ForwardedRef,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { forwardRef } from 'react'
import clsx from 'clsx'

export function AppCard({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <section className={clsx('ui-card', className)}>{children}</section>
}

export function AppPanel({
  children,
  className,
  tone = 'default',
}: PropsWithChildren<{ className?: string; tone?: 'default' | 'butter' | 'peach' | 'teal' | 'surface' }>) {
  return (
    <div
      className={clsx(
        'ui-panel',
        tone === 'butter' && 'ui-panel--butter',
        tone === 'peach' && 'ui-panel--peach',
        tone === 'teal' && 'ui-panel--teal',
        tone === 'surface' && 'ui-panel--surface',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function AppButton({
  children,
  className,
  variant = 'primary',
  ...props
}: PropsWithChildren<
  {
    className?: string
    variant?: 'primary' | 'secondary' | 'ghost'
  } & ButtonHTMLAttributes<HTMLButtonElement>
>) {
  return (
    <button
      className={clsx(
        'ui-button',
        variant === 'primary' && 'ui-button--primary',
        variant === 'secondary' && 'ui-button--secondary',
        variant === 'ghost' && 'ui-button--ghost',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function IconButton({
  className,
  tone = 'default',
  ...props
}: { className?: string; tone?: 'default' | 'butter' | 'peach' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        'ui-icon-button',
        tone === 'butter' && 'ui-icon-button--butter',
        tone === 'peach' && 'ui-icon-button--peach',
        className,
      )}
      {...props}
    />
  )
}

export function AppInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx('ui-input', className)} {...props} />
}

export const AppTextarea = forwardRef(function AppTextarea(
  { className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>,
  ref: ForwardedRef<HTMLTextAreaElement>,
) {
  return <textarea ref={ref} className={clsx('ui-input ui-textarea', className)} {...props} />
})

export function AppSelect({ className, children, ...props }: PropsWithChildren<SelectHTMLAttributes<HTMLSelectElement>>) {
  return (
    <select className={clsx('ui-input ui-select', className)} {...props}>
      {children}
    </select>
  )
}

export function FieldLabel({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <label className={clsx('ui-field-label', className)}>{children}</label>
}

export function AppPill({
  children,
  className,
  tone = 'default',
}: PropsWithChildren<{ className?: string; tone?: 'default' | 'butter' | 'peach' | 'teal' }>) {
  return (
    <span
      className={clsx(
        'ui-pill',
        tone === 'butter' && 'ui-pill--butter',
        tone === 'peach' && 'ui-pill--peach',
        tone === 'teal' && 'ui-pill--teal',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="ui-section-heading">
      <div>
        <p className="ui-eyebrow">{eyebrow}</p>
        <h2 className="ui-section-title">{title}</h2>
      </div>
      {action}
    </div>
  )
}
