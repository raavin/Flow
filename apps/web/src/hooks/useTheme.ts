import { useEffect, useState } from 'react'

export const THEMES = ['quirky', 'clean', 'flow', 'mono'] as const
type Theme = (typeof THEMES)[number]
export const THEME_LABELS: Record<Theme, string> = {
  quirky: 'Quirky',
  clean: 'Clean',
  flow: 'Flow',
  mono: 'Mono',
}

function isTheme(value: string | null): value is Theme {
  return THEMES.some((theme) => theme === value)
}

function initialTheme(): Theme {
  // Reuse the pre-paint theme, including an in-memory choice when storage fails.
  const applied = document.documentElement.getAttribute('data-theme')
  if (isTheme(applied)) return applied
  try {
    const saved = localStorage.getItem('superapp-theme')
    if (isTheme(saved)) return saved
  } catch {
    // Browser storage is optional.
  }
  return 'mono'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('superapp-theme', theme)
    } catch {
      // Keep theme switching usable when persistence is unavailable.
    }
  }, [theme])

  function cycleTheme() {
    setTheme((current) => THEMES[(THEMES.indexOf(current) + 1) % THEMES.length])
  }

  return { theme, setTheme, cycleTheme }
}
