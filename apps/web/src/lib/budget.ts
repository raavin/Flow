export type Cost = {
  estimate_cents: number
  actual_cents: number
  payment_status: 'unpaid' | 'pending' | 'paid'
}

// Integer cents keep all budget calculations independent of display rounding.
export function parseBudgetAmount(value: string): number {
  const text = value.trim()
  if (!text) return 0
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('Enter a positive amount with up to two decimal places.')
  const [whole, fraction = ''] = text.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  assertBudgetAmount(cents)
  return cents
}

export function assertBudgetAmount(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 2147483647) {
    throw new Error('Amount must be between $0 and $21,474,836.47.')
  }
}

export function summarizeCosts(costs: Cost[]) {
  return costs.reduce((total, cost) => {
    const forecast = cost.payment_status === 'paid' || cost.actual_cents > 0 ? cost.actual_cents : cost.estimate_cents
    total.estimated += cost.estimate_cents
    total.actual += cost.actual_cents
    total.forecast += forecast
    if (cost.payment_status === 'paid') total.paid += cost.actual_cents
    else total.remaining += forecast
    return total
  }, { estimated: 0, actual: 0, forecast: 0, paid: 0, remaining: 0 })
}
