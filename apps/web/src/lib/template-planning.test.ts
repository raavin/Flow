import { describe, expect, it } from 'vitest'
import { templateSchedule } from './template-planning'
import type { CoordinationTemplateBlock } from '@superapp/types'
const step = (title: string, offsetDays: number, durationDays = 1): CoordinationTemplateBlock => ({ title, kind: 'plan', displayKind: 'task', intent: 'coordinate', offsetDays, durationDays })
describe('template dates', () => {
  it('maps preparation, event and follow-up across month and year boundaries', () => {
    expect(templateSchedule([step('Gift', -7), step('Party', 0), step('Thank people', 1, 2)], '2027-01-02')).toEqual([
      { title: 'Gift', startsOn: '2026-12-26', endsOn: '2026-12-26' },
      { title: 'Party', startsOn: '2027-01-02', endsOn: '2027-01-02' },
      { title: 'Thank people', startsOn: '2027-01-03', endsOn: '2027-01-04' },
    ])
  })
  it('handles leap days', () => expect(templateSchedule([step('Prepare', -1)], '2028-03-01')[0].startsOn).toBe('2028-02-29'))
  it.each(['', '2027-02-30', 'bad date'])('rejects invalid anchor %s before any writes', date => expect(() => templateSchedule([step('Gift', -7)], date)).toThrow())
  it('rejects an empty plan or invalid steps', () => {
    expect(() => templateSchedule([], '2027-01-02')).toThrow()
    expect(() => templateSchedule([step('', 0)], '2027-01-02')).toThrow()
    expect(() => templateSchedule([step('Gift', 0.5)], '2027-01-02')).toThrow()
    expect(() => templateSchedule([step('Gift', 0, 0)], '2027-01-02')).toThrow()
  })
})
