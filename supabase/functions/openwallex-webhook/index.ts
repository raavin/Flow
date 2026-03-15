import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { verifyHmacSha256 } from '../_shared/hmac.ts'
import { createServiceClient } from '../_shared/db.ts'
import { normaliseOpenWallexEvent } from '../_shared/providers/openwallex.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  const sigHeader = req.headers.get('x-openwallex-signature') ?? ''
  const secret    = Deno.env.get('OPENWALLEX_WEBHOOK_SECRET') ?? ''

  if (!secret) return errorResponse('Webhook secret not configured', 500)

  const rawBody = new Uint8Array(await req.arrayBuffer())
  const valid   = await verifyHmacSha256(secret, rawBody, sigHeader)
  if (!valid) return errorResponse('Signature verification failed', 401)

  const event      = JSON.parse(new TextDecoder().decode(rawBody))
  const normalised = normaliseOpenWallexEvent(event)
  const db         = createServiceClient()

  switch (normalised.kind) {
    case 'payment_succeeded': {
      if (normalised.orderId) {
        await db
          .from('commerce_orders')
          .update({
            payment_status: 'paid',
            status: 'paid',
            payment_reference: normalised.transactionId,
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
    default:
      break
  }

  return jsonResponse({ received: true })
})
