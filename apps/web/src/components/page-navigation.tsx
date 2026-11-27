import { useEffect, useRef, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/** Links stay directly available on wide panels; narrow panels get a named page chooser. */
export function PageNavigation({
  label,
  compactLabel,
  currentPage,
  children,
  compactChildren = children,
}: {
  label: string
  compactLabel: string
  currentPage: string
  children: ReactNode
  compactChildren?: ReactNode
}) {
  const disclosure = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (disclosure.current) disclosure.current.open = false
  }, [currentPage])

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !disclosure.current?.contains(event.target)) {
        if (disclosure.current) disclosure.current.open = false
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  return (
    <div className="flow-page-navigation">
      <details
        ref={disclosure}
        className="flow-page-navigation__compact"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && disclosure.current?.open) {
            event.preventDefault()
            disclosure.current.open = false
            disclosure.current.querySelector('summary')?.focus()
          }
        }}
      >
        <summary aria-label={`${compactLabel}: ${currentPage}`}>
          <span className="min-w-0">
            <span className="block text-xs font-normal text-ink/65">{compactLabel}</span>
            <span className="block break-words font-semibold">{currentPage}</span>
          </span>
          <ChevronDown aria-hidden="true" size={18} className="shrink-0" />
        </summary>
        <nav
          aria-label={compactLabel}
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest('a')) {
              if (disclosure.current) disclosure.current.open = false
            }
          }}
        >
          {compactChildren}
        </nav>
      </details>
      <nav aria-label={label} className="flow-page-navigation__links">
        {children}
      </nav>
    </div>
  )
}
