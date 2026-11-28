import { expect, it } from 'vitest'
import { relativePostDate } from './display-date'
const now = new Date('2026-11-28T12:00:00Z').getTime()
it('uses minutes, hours and days only for recent posts', () => {
  expect(relativePostDate('2026-11-28T11:59:40Z', now)).toBe('Just now')
  expect(relativePostDate('2026-11-28T11:57:00Z', now)).toBe('3m')
  expect(relativePostDate('2026-11-28T10:00:00Z', now)).toBe('2h')
  expect(relativePostDate('2026-11-26T12:00:00Z', now)).toBe('2d')
  expect(relativePostDate('2026-03-19T12:00:00Z', now)).toBe('19 Mar')
  expect(relativePostDate('2025-03-19T12:00:00Z', now)).toBe('19 Mar 2025')
})
it('handles clock skew and invalid dates', () => {
  expect(relativePostDate('2026-11-29T12:00:00Z', now)).toBe('Just now')
  expect(relativePostDate('invalid', now)).toBe('Date unavailable')
})
