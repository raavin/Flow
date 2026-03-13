export function readLocal<T>(key: string, fallback: T): T {
  if (
    typeof window === 'undefined' ||
    !window.localStorage ||
    typeof window.localStorage.getItem !== 'function'
  ) {
    return fallback
  }

  const raw = window.localStorage.getItem(key)
  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeLocal<T>(key: string, value: T) {
  if (
    typeof window === 'undefined' ||
    !window.localStorage ||
    typeof window.localStorage.setItem !== 'function'
  ) {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}
