import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { verifyHmacSha256 } from '../_shared/hmac.ts'
import { createServiceClient } from '../_shared/db.ts'
import { normaliseStripeEvent, parseStripeSignature } from '../_shared/providers/stripe.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  const sigHeader = req.headers.get('stripe-signature')
  if (!sigHeader) return errorResponse('Missing Stripe-Signature', 400)

  const parsed = parseStripeSignature(sigHeader)
  if (!parsed) return errorResponse('Malformed Stripe-Signature', 400)

  const rawBody = new Uint8Array(await req.arrayBuffer())
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!secret) return errorResponse('Webhook secret not configured', 500)

  // Stripe signs: "<timestamp>.<rawBody>"
  const enc = new TextEncoder()
  const signedPayload = new Uint8Array([
    ...enc.encode(`${parsed.timestamp}.`),
    ...rawBody,
  ])

  const valid = await verifyHmacSha256(secret, signedPayload, parsed.v1)
  if (!valid) return errorResponse('Signature verification failed', 401)

  // Reject replays older than 5 minutes
  const ts = parseInt(parsed.timestamp, 10)
  if (Date.now() / 1000 - ts > 300) return errorResponse('Webhook timestamp too old', 400)

  const event = JSON.parse(new TextDecoder().decode(rawBody))
  const normalised = normaliseStripeEvent(event)

  const db = createServiceClient()

  switch (normalised.kind) {
    case 'payment_succeeded': {
      if (normalised.orderId) {
        await db
          .from('commerce_orders')
          .update({
            payment_status: 'paid',
            status: 'paid',
            payment_reference: normalised.paymentIntentId,
          })
          .eq('id', normalised.orderId)
      }
      break
    }
    case 'payment_refunded': {
      if (normalised.orderId) {
        await db
          .from('commerce_orders')
          .update({ payment_status: 'refunded', status: 'refunded' })
          .eq('id', normalised.orderId)
      }
      break
    }
    case 'account_updated': {
      if (normalised.stripeAccountId) {
        await db
          .from('connected_integrations')
          .update({
            metadata: db.rpc as never, // placeholder — real impl patches jsonb
            updated_at: new Date().toISOString(),
          })
          .eq('provider', 'stripe')
          .contains('metadata', { stripe_account_id: normalised.stripeAccountId })
      }
      break
    }
    default:
      break
  }

  return jsonResponse({ received: true })
})
