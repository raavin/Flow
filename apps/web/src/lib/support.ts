import supportIndex from '@/data/support-index.json'

export type SupportEntry = {
  id: string
  slug: string
  title: string
  summary: string
  body: string
  shortcut?: string
  tags: string[]
  keywords: string[]
  route?: string
}

const entries = supportIndex as SupportEntry[]

export function getSupportEntries() {
  return entries
}

export function searchSupportEntries(query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return entries

  return entries.filter((entry) =>
    [entry.title, entry.summary, entry.body, entry.shortcut ?? '', ...entry.tags, ...entry.keywords].some((value) => value.toLowerCase().includes(needle)),
  )
}

export function findSupportEntryBySlug(slug: string) {
  return entries.find((entry) => entry.slug === slug) ?? null
}
