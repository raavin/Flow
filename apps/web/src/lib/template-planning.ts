import type { CoordinationTemplateBlock } from '@superapp/types'

export function templateSchedule(blocks: CoordinationTemplateBlock[], anchorDate: string) {
  const anchor = new Date(`${anchorDate}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate) || Number.isNaN(anchor.getTime()) || anchor.toISOString().slice(0, 10) !== anchorDate) throw new Error('Choose a valid anchor date.')
  if (!blocks.length) throw new Error('Add at least one step.')
  return blocks.map(block => {
    const offset = block.offsetDays ?? 0
    const duration = block.durationDays ?? 1
    if (!block.title.trim() || !Number.isInteger(offset) || Math.abs(offset) > 3650 || !Number.isInteger(duration) || duration < 1 || duration > 3650) throw new Error('Each step needs a name, a whole-day offset within 10 years, and a duration of 1–3650 days.')
    const start = new Date(anchor)
    start.setUTCDate(start.getUTCDate() + offset)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + duration - 1)
    return { title: block.title, startsOn: start.toISOString().slice(0, 10), endsOn: end.toISOString().slice(0, 10) }
  })
}
