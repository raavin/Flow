import html from '../../index.html?raw'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THEMES, useTheme } from './useTheme'

const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)![1]

function loadPage() {
  document.documentElement.setAttribute('data-theme', html.match(/data-theme="([^"]+)"/)![1])
  new Function('localStorage', 'document', bootstrap)(localStorage, document)
}

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  })
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-theme')
})

describe('theme persistence across public and authenticated routes', () => {
  it.each(THEMES)('restores %s before React or authentication mounts', (theme) => {
    localStorage.setItem('superapp-theme', theme)
    loadPage()
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme)
    const { result } = renderHook(useTheme)
    expect(result.current.theme).toBe(theme)
  })

  it.each([null, '', 'unknown'])('uses Mono for missing or invalid preference: %s', (saved) => {
    if (saved !== null) localStorage.setItem('superapp-theme', saved)
    loadPage()
    expect(document.documentElement.getAttribute('data-theme')).toBe('mono')
  })

  it('keeps a changed theme through sign-out, reload, and layout remount', () => {
    loadPage()
    const first = renderHook(useTheme)
    act(() => first.result.current.cycleTheme())
    expect(first.result.current.theme).toBe('quirky')
    expect(localStorage.getItem('superapp-theme')).toBe('quirky')
    first.unmount()
    expect(document.documentElement.getAttribute('data-theme')).toBe('quirky')
    loadPage()
    expect(document.documentElement.getAttribute('data-theme')).toBe('quirky')
    const next = renderHook(useTheme)
    expect(next.result.current.theme).toBe('quirky')
  })

  it('still loads and switches themes when browser storage throws', () => {
    vi.mocked(localStorage.getItem).mockImplementation(() => { throw new Error('Blocked') })
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error('Blocked') })
    expect(loadPage).not.toThrow()
    const first = renderHook(useTheme)
    expect(first.result.current.theme).toBe('mono')
    act(() => first.result.current.cycleTheme())
    expect(document.documentElement.getAttribute('data-theme')).toBe('quirky')
    first.unmount()
    const next = renderHook(useTheme)
    expect(next.result.current.theme).toBe('quirky')
  })
})
