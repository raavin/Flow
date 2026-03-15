import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/db.ts'
import { normalisePayPalEvent, verifyPayPalWebhook } from '../_shared/providers/paypal.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  const transmissionId   = req.headers.get('paypal-transmission-id') ?? ''
  const transmissionTime = req.headers.get('paypal-transmission-time') ?? ''
  const certUrl          = req.headers.get('paypal-cert-url') ?? ''
  const authAlgo         = req.headers.get('paypal-auth-algo') ?? ''
  const transmissionSig  = req.headers.get('paypal-transmission-sig') ?? ''
  const webhookId        = Deno.env.get('PAYPAL_WEBHOOK_ID') ?? ''
  const accessToken      = Deno.env.get('PAYPAL_ACCESS_TOKEN') ?? ''

  if (!transmissionId || !webhookId || !accessToken) {
    return errorResponse('Missing PayPal verification headers or config', 400)
  }

  const rawBody   = await req.text()
  const eventJson = JSON.parse(rawBody)

  const valid = await verifyPayPalWebhook({
    transmissionId,
    transmissionTime,
    webhookId,
    certUrl,
    authAlgo,
    transmissionSig,
    webhookEvent: eventJson,
    accessToken,
  })
  if (!valid) return errorResponse('PayPal signature verification failed', 401)

  const normalised = normalisePayPalEvent(eventJson)
  const db = createServiceClient()

  switch (normalised.kind) {
    case 'payment_succeeded': {
      if (normalised.orderId) {
        await db
          .from('commerce_orders')
          .update({
            payment_status: 'paid',
            status: 'paid',
            payment_reference: normalised.captureId,
          })
          .eq('id', normalised.orderId)
      }
      break
    }
    case 'payment_refunded': {
      if (normalised.captureId) {
        // Best effort — link by payment_reference
        await db
          .from('commerce_orders')
          .update({ payment_status: 'refunded', status: 'refunded' })
          .eq('payment_reference', normalised.captureId)
      }
      break
    }
    default:
      break
  }

  return jsonResponse({ received: true })
})
