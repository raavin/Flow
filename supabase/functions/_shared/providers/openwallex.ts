export interface OpenWallexEvent {
  type: string
  data: Record<string, unknown>
}

export interface NormalisedOpenWallexEvent {
  kind: 'payment_succeeded' | 'payment_refunded' | 'unknown'
  orderId: string | null
  transactionId: string | null
  raw: OpenWallexEvent
}

export function normaliseOpenWallexEvent(event: OpenWallexEvent): NormalisedOpenWallexEvent {
  const data = event.data

  switch (event.type) {
    case 'payment.completed': {
      return {
        kind: 'payment_succeeded',
        orderId: (data.reference_id as string) ?? null,
        transactionId: (data.payment_id as string) ?? null,
        raw: event,
      }
    }
    case 'payment.refunded': {
      return {
        kind: 'payment_refunded',
        orderId: (data.reference_id as string) ?? null,
        transactionId: (data.payment_id as string) ?? null,
        raw: event,
      }
    }
    default:
      return { kind: 'unknown', orderId: null, transactionId: null, raw: event }
  }
}
