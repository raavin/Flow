/**
 * POST /functions/v1/api/v1/shifts
 * Auth: Bearer sa_live_...  (scope: shifts:write)
 * Body: {
 *   shiftly_shift_id: string,
 *   worker_profile_id: string,
 *   project_id?: string,
 *   amount_cents: number,
 *   currency_code: string,
 *   completed_at: string,
 *   description: string
 * }
 * Returns: 201 { transaction_id }
 */

import { corsResponse, errorResponse, jsonResponse } from '../../../_shared/cors.ts'
import { verifyApiKey } from '../../../_shared/auth.ts'
import { createServiceClient } from '../../../_shared/db.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  const identity = await verifyApiKey(req)
  if (!identity) return errorResponse('Unauthorized', 401)
  if (!identity.scopes.includes('shifts:write')) return errorResponse('Insufficient scope', 403)

  const body = await req.json().catch(() => null) as {
    shiftly_shift_id: string
    worker_profile_id: string
    project_id?: string
    amount_cents: number
    currency_code?: string
    completed_at: string
    description?: string
  } | null

  if (!body?.shiftly_shift_id || !body?.worker_profile_id || !body?.amount_cents) {
    return errorResponse('Missing required fields: shiftly_shift_id, worker_profile_id, amount_cents', 400)
  }

  const db = createServiceClient()

  // Idempotency: check if this shift was already recorded
  const { data: existing } = await db
    .from('financial_transactions')
    .select('id')
    .eq('reference_number', `shiftly:${body.shiftly_shift_id}`)
    .maybeSingle()

  if (existing) {
    return jsonResponse({ transaction_id: existing.id }, 200)
  }

  const { data: inserted, error } = await db
    .from('financial_transactions')
    .insert({
      profile_id:             identity.profileId,
      counterparty_profile_id: body.worker_profile_id,
      linked_project_id:      body.project_id ?? null,
      transaction_role:       'manual',
      transaction_type:       'payout',
      source_kind:            'project',
      direction:              'out',
      description:            body.description ?? `Shift completion — Shiftly ${body.shiftly_shift_id}`,
      counterparty_label:     body.worker_profile_id,
      reference_number:       `shiftly:${body.shiftly_shift_id}`,
      currency_code:          body.currency_code ?? 'AUD',
      subtotal_cents:         body.amount_cents,
      tax_cents:              0,
      platform_fee_cents:     0,
      total_cents:            body.amount_cents,
      seller_net_cents:       body.amount_cents,
      status:                 'paid',
      payout_status:          'paid',
      occurred_at:            body.completed_at,
    })
    .select('id')
    .single()

  if (error) return errorResponse(error.message, 500)

  return jsonResponse({ transaction_id: inserted.id }, 201)
})
