/**
 * GET /functions/v1/api/v1/orders?since=<ISO>&status=<status>
 * Auth: Bearer sa_live_...  (scope: orders:read)
 * Returns: commerce_orders where seller_profile_id = caller
 */

import { corsResponse, errorResponse, jsonResponse } from '../../../_shared/cors.ts'
import { verifyApiKey } from '../../../_shared/auth.ts'
import { createServiceClient } from '../../../_shared/db.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  const identity = await verifyApiKey(req)
  if (!identity) return errorResponse('Unauthorized', 401)
  if (!identity.scopes.includes('orders:read')) return errorResponse('Insufficient scope', 403)

  const url    = new URL(req.url)
  const since  = url.searchParams.get('since')
  const status = url.searchParams.get('status')

  const db = createServiceClient()
  let query = db
    .from('commerce_orders')
    .select(`
      id, order_number, buyer_profile_id, seller_profile_id,
      status, payment_status, payout_status,
      total_cents, currency_code, created_at
    `)
    .eq('seller_profile_id', identity.profileId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (since) query = query.gte('created_at', since)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)

  return jsonResponse({ orders: data ?? [] })
})
