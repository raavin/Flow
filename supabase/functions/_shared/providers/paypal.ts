export interface PayPalWebhookEvent {
  id: string
  event_type: string
  resource: Record<string, unknown>
}

export interface NormalisedPayPalEvent {
  kind: 'payment_succeeded' | 'payment_refunded' | 'unknown'
  orderId: string | null
  captureId: string | null
  raw: PayPalWebhookEvent
}

export function normalisePayPalEvent(event: PayPalWebhookEvent): NormalisedPayPalEvent {
  const resource = event.resource

  switch (event.event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED': {
      const custom = (resource.custom_id as string) ?? null
      return {
        kind: 'payment_succeeded',
        orderId: custom,
        captureId: resource.id as string,
        raw: event,
      }
    }
    case 'PAYMENT.CAPTURE.REFUNDED': {
      const links = (resource.links as Array<{ rel: string; href: string }>) ?? []
      const upLink = links.find((l) => l.rel === 'up')
      const captureId = upLink?.href.split('/').pop() ?? null
      return {
        kind: 'payment_refunded',
        orderId: null,
        captureId,
        raw: event,
      }
    }
    default:
      return { kind: 'unknown', orderId: null, captureId: null, raw: event }
  }
}

/**
 * Verify a PayPal webhook by calling PayPal's verification API.
 * Returns true if valid.
 */
export async function verifyPayPalWebhook(params: {
  transmissionId: string
  transmissionTime: string
  webhookId: string
  certUrl: string
  authAlgo: string
  transmissionSig: string
  webhookEvent: unknown
  accessToken: string
}): Promise<boolean> {
  const body = {
    transmission_id:   params.transmissionId,
    transmission_time: params.transmissionTime,
    cert_url:          params.certUrl,
    auth_algo:         params.authAlgo,
    transmission_sig:  params.transmissionSig,
    webhook_id:        params.webhookId,
    webhook_event:     params.webhookEvent,
  }
  const res = await fetch(
    'https://api-m.paypal.com/v1/notifications/verify-webhook-signature',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.accessToken}`,
      },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) return false
  const json = await res.json() as { verification_status: string }
  return json.verification_status === 'SUCCESS'
}
