/**
 * GET /functions/v1/api/v1/schedules?from=<ISO>&to=<ISO>
 * Auth: Bearer sa_live_...  (scope: schedules:read)
 * Returns: calendar_events where owner_id = caller
 */

import { corsResponse, errorResponse, jsonResponse } from '../../../_shared/cors.ts'
import { verifyApiKey } from '../../../_shared/auth.ts'
import { createServiceClient } from '../../../_shared/db.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  const identity = await verifyApiKey(req)
  if (!identity) return errorResponse('Unauthorized', 401)
  if (!identity.scopes.includes('schedules:read')) return errorResponse('Insufficient scope', 403)

  const url  = new URL(req.url)
  const from = url.searchParams.get('from')
  const to   = url.searchParams.get('to')

  const db = createServiceClient()
  let query = db
    .from('calendar_events')
    .select('id, title, starts_at, ends_at, notes, project_id')
    .eq('owner_id', identity.profileId)
    .order('starts_at', { ascending: true })
    .limit(500)

  if (from) query = query.gte('starts_at', from)
  if (to)   query = query.lte('starts_at', to)

  const { data, error } = await query
  if (error) return errorResponse(error.message, 500)

  return jsonResponse({ schedules: data ?? [] })
})
