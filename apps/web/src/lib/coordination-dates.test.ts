import { it, expect } from 'vitest'
import { calendarDay, coordinationDays } from './coordination-dates'
import type { CoordinationObject } from '@superapp/types'
const step = (startsAt: string, endsAt: string, template = true) =>
  ({
    time: { startsAt, endsAt, isAllDay: true },
    metadata: template ? { templateApplicationId: 'application' } : {},
  }) as CoordinationObject
it('keeps a Melbourne template on its chosen local day across a UTC year boundary', () => {
  const days = coordinationDays(step('2026-12-31T13:00:00Z', '2027-01-01T12:59:59Z'), 'Australia/Melbourne')
  expect(days).toEqual({ start: '2027-01-01', end: '2027-01-01' })
  expect('2026-12-31' >= days.start! && '2026-12-31' <= days.end!).toBe(false)
})
it('handles negative offsets and daylight-saving days without adding a second day', () => {
  expect(
    coordinationDays(step('2027-01-02T08:00:00Z', '2027-01-03T07:59:59Z'), 'America/Los_Angeles'),
  ).toEqual({ start: '2027-01-02', end: '2027-01-02' })
  expect(
    coordinationDays(step('2027-03-14T08:00:00Z', '2027-03-15T06:59:59Z'), 'America/Los_Angeles'),
  ).toEqual({ start: '2027-03-14', end: '2027-03-14' })
})
it('retains date-only values and legacy all-day records', () => {
  expect(calendarDay('2027-01-02', 'America/Los_Angeles')).toBe('2027-01-02')
  expect(
    coordinationDays(step('2027-01-02T00:00:00Z', '2027-01-02T23:59:59Z', false), 'Australia/Melbourne'),
  ).toEqual({ start: '2027-01-02', end: '2027-01-02' })
  expect(calendarDay(null)).toBeUndefined()
})
