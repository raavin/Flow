import { describe, expect, it } from 'vitest'
import { parseBudgetAmount, summarizeCosts } from './budget'

describe('budget amounts', () => {
  it.each([['0', 0], ['12.10', 1210], ['0.29', 29], [' 100 ', 10000], ['', 0]])('parses %s without floating point drift', (input, expected) => expect(parseBudgetAmount(input)).toBe(expected))
  it.each(['-1', '1.001', 'NaN', 'Infinity', '1e3', '21474836.48', 'five'])('rejects invalid amount %s', input => expect(() => parseBudgetAmount(input)).toThrow())
  it('uses estimates until actuals arrive and does not count paid costs twice', () => {
    expect(summarizeCosts([
      { estimate_cents: 10000, actual_cents: 0, payment_status: 'unpaid' },
      { estimate_cents: 5000, actual_cents: 6000, payment_status: 'pending' },
      { estimate_cents: 2000, actual_cents: 1800, payment_status: 'paid' },
      { estimate_cents: 1000, actual_cents: 0, payment_status: 'paid' },
    ])).toEqual({ estimated: 18000, actual: 7800, forecast: 17800, paid: 1800, remaining: 16000 })
  })
})
