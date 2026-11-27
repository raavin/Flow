import type { CoordinationObject } from '@superapp/types'
export function groupCoordinationObjects(items: CoordinationObject[], now = new Date()) {
  // Compare local days, not UTC dates that change midday in Australia.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
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
    const date = item.time.startsAt || item.time.dueAt
    const value = date ? new Date(date) : null
    const day = value ? new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime() : null
    if (item.state === 'active' || (day !== null && day <= today)) groups.now.push(item)
    else if (day !== null) groups.next.push(item)
    else groups.backlog.push(item)
  }
  return groups
}
