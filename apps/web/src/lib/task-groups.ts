import { calendarDay, coordinationDays } from './coordination-dates'
import type { CoordinationObject } from '@superapp/types'
export function groupCoordinationObjects(items: CoordinationObject[], now = new Date()) {
  // Compare local days, not UTC dates that change midday in Australia.
  const today = calendarDay(now.toISOString())!
  const groups: Record<'now' | 'next' | 'backlog' | 'done', CoordinationObject[]> = {
    now: [],
    next: [],
    backlog: [],
    done: [],
  }
  for (const item of items) {
    if (item.state === 'archived' || item.kind === 'message' || item.kind === 'dm_thread') continue
    if (item.state === 'completed') {
      groups.done.push(item)
      continue
    }
    const day = coordinationDays(item).start
    if (item.state === 'active' || (day !== undefined && day <= today)) groups.now.push(item)
    else if (day !== undefined) groups.next.push(item)
    else groups.backlog.push(item)
  }
  return groups
}
