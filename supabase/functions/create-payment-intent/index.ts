/**
 * create-payment-intent — create a Stripe PaymentIntent for a pending order.
 * Called by the SPA at checkout when the seller has Stripe connected.
 *
 * POST /functions/v1/create-payment-intent
 * Auth: Supabase JWT
 * Body: { order_id: string }
 * Returns: { client_secret: string, payment_intent_id: string }
 */

import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { verifyJwt } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  const user = await verifyJwt(req)
  if (!user) return errorResponse('Unauthorized', 401)

  const body = await req.json().catch(() => ({})) as { order_id?: string }
  if (!body.order_id) return errorResponse('order_id required', 400)

  const db = createServiceClient()

  // Load the pending order
  const { data: order, error: orderError } = await db
    .from('commerce_orders')
    .select('id, total_cents, currency_code, seller_profile_id, platform_fee_cents, payment_status')
    .eq('id', body.order_id)
    .eq('buyer_profile_id', user.id)
    .single()

  if (orderError || !order) return errorResponse('Order not found', 404)
  if (order.payment_status !== 'pending') return errorResponse('Order already paid', 409)

  // Load seller's Stripe connected account
  const { data: integration } = await db
    .from('connected_integrations')
    .select('metadata, status')
    .eq('profile_id', order.seller_profile_id)
    .eq('provider', 'stripe')
    .single()

  const stripeAccountId = (integration?.metadata as Record<string, string> | null)?.stripe_account_id
  if (!stripeAccountId || integration?.status !== 'active') {
    return errorResponse('Seller has not connected Stripe', 409)
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeSecretKey) return errorResponse('Stripe not configured', 500)

  // Create PaymentIntent via Stripe API
  const params = new URLSearchParams({
    amount:                          String(order.total_cents),
    currency:                        order.currency_code.toLowerCase(),
    'transfer_data[destination]':    stripeAccountId,
    'metadata[order_id]':            order.id,
    'automatic_payment_methods[enabled]': 'true',
  })
  if (order.platform_fee_cents > 0) {
    params.set('application_fee_amount', String(order.platform_fee_cents))
  }

  const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  if (!stripeRes.ok) {
    const err = await stripeRes.text()
    console.error('Stripe API error:', err)
    return errorResponse('Failed to create payment intent', 502)
  }

  const pi = await stripeRes.json() as { id: string; client_secret: string }

  return jsonResponse({
    client_secret:      pi.client_secret,
    payment_intent_id:  pi.id,
  })
})
