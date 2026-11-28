export function hasUnsafeUrlCharacters(value: string) {
  return Array.from(value).some((char) => char === '\\' || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
}

/** Only local application destinations are accepted from stored or URL-provided links. */
export function appDestination(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/app/')) return undefined
  try {
    const decoded = decodeURIComponent(value)
    if (hasUnsafeUrlCharacters(decoded) || decoded.startsWith('//')) return undefined
    const url = new URL(value, 'https://flow.invalid')
    if (url.origin !== 'https://flow.invalid' || !url.pathname.startsWith('/app/')) return undefined
    // Dot segments must not escape the application after URL decoding either.
    const normalized = new URL(decoded, 'https://flow.invalid')
    if (!normalized.pathname.startsWith('/app/')) return undefined
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return undefined
  }
}
