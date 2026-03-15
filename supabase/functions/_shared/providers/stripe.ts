export interface StripeEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

export interface NormalisedPaymentEvent {
  kind: 'payment_succeeded' | 'payment_refunded' | 'account_updated' | 'unknown'
  orderId: string | null
  paymentIntentId: string | null
  stripeAccountId: string | null
  raw: StripeEvent
}

export function normaliseStripeEvent(event: StripeEvent): NormalisedPaymentEvent {
  const obj = event.data.object

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const meta = (obj.metadata as Record<string, string>) ?? {}
      return {
        kind: 'payment_succeeded',
        orderId: meta.order_id ?? null,
        paymentIntentId: obj.id as string,
        stripeAccountId: null,
        raw: event,
      }
    }
    case 'charge.refunded': {
      const pi = obj.payment_intent as string | null
      const meta = (obj.metadata as Record<string, string>) ?? {}
      return {
        kind: 'payment_refunded',
        orderId: meta.order_id ?? null,
        paymentIntentId: pi,
        stripeAccountId: null,
        raw: event,
      }
    }
    case 'account.updated': {
      return {
        kind: 'account_updated',
        orderId: null,
        paymentIntentId: null,
        stripeAccountId: obj.id as string,
        raw: event,
      }
    }
    default:
      return {
        kind: 'unknown',
        orderId: null,
        paymentIntentId: null,
        stripeAccountId: null,
        raw: event,
      }
  }
}

/**
 * Parse and verify a Stripe-Signature header.
 * Format: t=<timestamp>,v1=<hex_sig>
 * Signed payload: "<timestamp>.<rawBody>"
 */
export function parseStripeSignature(header: string): { timestamp: string; v1: string } | null {
  const parts: Record<string, string> = {}
  for (const seg of header.split(',')) {
    const [k, v] = seg.split('=')
    if (k && v) parts[k.trim()] = v.trim()
  }
  if (!parts['t'] || !parts['v1']) return null
  return { timestamp: parts['t'], v1: parts['v1'] }
}
