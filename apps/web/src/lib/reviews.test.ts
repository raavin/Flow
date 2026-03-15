import { describe, expect, it } from 'vitest'
import { formatRating, ratingToStars } from './reviews'

describe('formatRating', () => {
  it('returns — when there are no reviews', () => {
    expect(formatRating(0, 0)).toBe('—')
  })

  it('returns the average to 1 decimal place', () => {
    expect(formatRating(10, 2)).toBe('5.0')
    expect(formatRating(9, 2)).toBe('4.5')
    expect(formatRating(43, 9)).toBe('4.8')
  })

  it('handles single review', () => {
    expect(formatRating(4, 1)).toBe('4.0')
    expect(formatRating(1, 1)).toBe('1.0')
  })
})

describe('ratingToStars', () => {
  it('shows 5 full stars for 5.0', () => {
    const result = ratingToStars(5)
    expect(result.full).toBe(5)
    expect(result.half).toBe(false)
    expect(result.empty).toBe(0)
  })

  it('shows 4 full stars for 4.0', () => {
    const result = ratingToStars(4)
    expect(result.full).toBe(4)
    expect(result.half).toBe(false)
    expect(result.empty).toBe(1)
  })

  it('shows 4 full + 1 half for 4.5', () => {
    const result = ratingToStars(4.5)
    expect(result.full).toBe(4)
    expect(result.half).toBe(true)
    expect(result.empty).toBe(0)
  })

  it('shows half star at the 0.4 boundary', () => {
    const result = ratingToStars(4.4)
    expect(result.half).toBe(true)
  })

  it('does NOT show half star below 0.4', () => {
    const result = ratingToStars(4.3)
    expect(result.half).toBe(false)
    expect(result.full).toBe(4)
    expect(result.empty).toBe(1)
  })

  it('does NOT show half star at or above 0.9 (rounds to full)', () => {
    const result = ratingToStars(4.9)
    expect(result.half).toBe(false)
    expect(result.full).toBe(4)
    expect(result.empty).toBe(1)
  })

  it('shows 1 full star for 1.0', () => {
    const result = ratingToStars(1)
    expect(result.full).toBe(1)
    expect(result.half).toBe(false)
    expect(result.empty).toBe(4)
  })

  it('total stars always adds up to 5 (no half)', () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      const r = ratingToStars(rating)
      expect(r.full + (r.half ? 1 : 0) + r.empty).toBe(5)
    }
  })

  it('total stars always adds up to 5 (with half)', () => {
    const r = ratingToStars(3.5)
    expect(r.full + (r.half ? 1 : 0) + r.empty).toBe(5)
  })
})
