import type { CheckoutSummary } from '@superapp/types'

export const DEFAULT_CURRENCY_CODE = 'AUD'
export const DEFAULT_TAX_RATE_BASIS_POINTS = 1000
export const DEFAULT_PLATFORM_FEE_BASIS_POINTS = 500

export function parsePriceLabelToCents(priceLabel: string) {
  const match = priceLabel.match(/(\d+(?:\.\d+)?)/)
  if (!match) return 0
  return Math.round(Number(match[1]) * 100)
}

export function formatCurrency(amountCents: number, currencyCode = DEFAULT_CURRENCY_CODE) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currencyCode,
  }).format(amountCents / 100)
}

export function supportsCartQuantity(kind: 'template' | 'service' | 'product') {
  return kind === 'product'
}

export function buildListingSku(input: { title: string; kind: 'template' | 'service' | 'product' }) {
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18)
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${input.kind.slice(0, 3).toUpperCase()}-${slug || 'ITEM'}-${suffix}`
}

export function computeCheckoutSummary(
  items: Array<{
    unitPriceCents: number
    quantity: number
    taxRateBasisPoints?: number | null
  }>,
  currencyCode = DEFAULT_CURRENCY_CODE,
): CheckoutSummary {
  const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)
  const taxCents = items.reduce(
    (sum, item) =>
      sum +
      Math.round((item.unitPriceCents * item.quantity * (item.taxRateBasisPoints ?? DEFAULT_TAX_RATE_BASIS_POINTS)) / 10000),
    0,
  )
  const totalCents = subtotalCents + taxCents

  return {
    currencyCode,
    subtotalCents,
    taxCents,
    totalCents,
  }
}
