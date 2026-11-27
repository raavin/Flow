import type { CoordinationObject } from '@superapp/types'
const formatters = new Map<string, Intl.DateTimeFormat>()
export function calendarDay(
  value: string | undefined | null,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string | undefined {
  if (!value) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return undefined
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    formatters.set(timeZone, formatter)
  }
  const parts = formatter.formatToParts(date)
  const part = (kind: string) => parts.find((p) => p.type === kind)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function coordinationDays(item: Pick<CoordinationObject, 'time' | 'metadata'>, timeZone?: string) {
  // Legacy all-day records use UTC fields as date-only values. New template
  // applications store real instants at local midnight, identified by metadata.
  const legacyAllDay = item.time.isAllDay && !item.metadata?.templateApplicationId
  const day = (value: string | undefined | null) =>
    legacyAllDay ? value?.slice(0, 10) : calendarDay(value, timeZone)
  return {
    start: day(item.time.startsAt ?? item.time.dueAt),
    end: day(item.time.endsAt ?? item.time.startsAt ?? item.time.dueAt),
  }
}
