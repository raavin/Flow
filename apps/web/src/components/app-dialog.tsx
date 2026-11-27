import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

/** Native modal: focus containment, Escape, inert background and focus restoration. */
export function AppDialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  useEffect(() => {
    const dialog = ref.current!
    const previous = document.activeElement as HTMLElement | null
    dialog.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      onCancel={onClose}
      className={`ui-dialog ${wide ? 'ui-dialog--wide' : ''}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border p-4">
        <h2 id={headingId} className="text-xl font-bold">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Close"
          className="inline-flex min-h-11 min-w-11 items-center justify-center"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div className="p-4 sm:p-6">{children}</div>
    </dialog>
  )
}
