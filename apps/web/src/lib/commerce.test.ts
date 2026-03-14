import { describe, expect, it } from 'vitest'
import { computeCheckoutSummary, parsePriceLabelToCents, supportsCartQuantity } from './commerce'

describe('commerce helpers', () => {
  it('parses common price labels into cents', () => {
    expect(parsePriceLabelToCents('$12 one-time')).toBe(1200)
    expect(parsePriceLabelToCents('From $180')).toBe(18000)
    expect(parsePriceLabelToCents('$65 bundle')).toBe(6500)
  })

  it('computes subtotal, tax, and total for checkout', () => {
    const summary = computeCheckoutSummary([
      { unitPriceCents: 1200, quantity: 1, taxRateBasisPoints: 1000 },
      { unitPriceCents: 6500, quantity: 2, taxRateBasisPoints: 1000 },
    ])

    expect(summary.subtotalCents).toBe(14200)
    expect(summary.taxCents).toBe(1420)
    expect(summary.totalCents).toBe(15620)
    expect(summary.currencyCode).toBe('AUD')
  })

  it('only allows cart quantities for products', () => {
    expect(supportsCartQuantity('product')).toBe(true)
    expect(supportsCartQuantity('service')).toBe(false)
    expect(supportsCartQuantity('template')).toBe(false)
  })
})
