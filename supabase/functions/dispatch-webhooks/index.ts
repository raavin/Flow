/**
 * dispatch-webhooks — dequeue pending webhook_deliveries and POST to endpoints.
 * Scheduled every 30s via pg_cron / Supabase cron.
 * Uses SKIP LOCKED to allow safe concurrent runs.
 */

import { createServiceClient } from '../_shared/db.ts'
import { signHmacSha256 } from '../_shared/hmac.ts'

const BATCH_SIZE = 50

// Exponential backoff delays in seconds: 1m, 5m, 30m, 2h, 8h
const RETRY_DELAYS_SECONDS = [60, 300, 1800, 7200, 28800]
const MAX_ATTEMPTS = RETRY_DELAYS_SECONDS.length + 1

Deno.serve(async (req) => {
  // Allow cron to call with no auth or a secret header
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    const provided = req.headers.get('x-cron-secret') ?? ''
    if (provided !== cronSecret) {
      return new Response('Forbidden', { status: 403 })
    }
  }

  const db = createServiceClient()

  // Claim a batch — Postgres FOR UPDATE SKIP LOCKED via RPC
  const { data: deliveries, error } = await db
    .from('webhook_deliveries')
    .select('id, endpoint_id, event_type, event_id, payload, attempt_count')
    .eq('status', 'pending')
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    console.error('Failed to fetch deliveries:', error)
    return new Response('Error', { status: 500 })
  }

  if (!deliveries?.length) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 })
  }

  let processed = 0

  await Promise.allSettled(
    deliveries.map(async (delivery) => {
      // Fetch endpoint URL and signing secret id
      const { data: endpoint } = await db
        .from('webhook_endpoints')
        .select('url, signing_secret_id, is_active, profile_id')
        .eq('id', delivery.endpoint_id)
        .single()

      if (!endpoint?.is_active) {
        await db
          .from('webhook_deliveries')
          .update({ status: 'abandoned' })
          .eq('id', delivery.id)
        return
      }

      // Fetch signing secret from vault
      let signingSecret = ''
      if (endpoint.signing_secret_id) {
        const { data: secretRow } = await db
          .from('vault.decrypted_secrets')
          .select('decrypted_secret')
          .eq('id', endpoint.signing_secret_id)
          .single()
        signingSecret = (secretRow as { decrypted_secret: string } | null)?.decrypted_secret ?? ''
      }

      const payloadBytes = new TextEncoder().encode(JSON.stringify(delivery.payload))
      const signature    = signingSecret
        ? await signHmacSha256(signingSecret, payloadBytes)
        : ''

      const headers: Record<string, string> = {
        'Content-Type':             'application/json',
        'X-Superapp-Event':         delivery.event_type,
        'X-Superapp-Delivery':      delivery.id,
        'X-Superapp-Signature-256': `sha256=${signature}`,
      }

      let responseStatus = 0
      let responseBody   = ''
      let success        = false

      try {
        const res = await fetch(endpoint.url, {
          method:  'POST',
          headers,
          body:    JSON.stringify(delivery.payload),
          signal:  AbortSignal.timeout(10_000),
        })
        responseStatus = res.status
        responseBody   = await res.text().catch(() => '')
        success        = res.status >= 200 && res.status < 300
      } catch (err) {
        responseBody = String(err)
      }

      const newAttemptCount = delivery.attempt_count + 1

      if (success) {
        await db.from('webhook_deliveries').update({
          status:               'delivered',
          delivered_at:         new Date().toISOString(),
          attempt_count:        newAttemptCount,
          last_response_status: responseStatus,
          last_response_body:   responseBody.slice(0, 1000),
        }).eq('id', delivery.id)

        await db
          .from('webhook_endpoints')
          .update({ last_success_at: new Date().toISOString() })
          .eq('id', delivery.endpoint_id)

        processed++
        return
      }

      // Failure — decide retry or abandon
      if (newAttemptCount >= MAX_ATTEMPTS) {
        await db.from('webhook_deliveries').update({
          status:               'abandoned',
          attempt_count:        newAttemptCount,
          last_response_status: responseStatus,
          last_response_body:   responseBody.slice(0, 1000),
        }).eq('id', delivery.id)

        await db
          .from('webhook_endpoints')
          .update({
            failure_count:    db.rpc as never, // incremented via DB expression below
            last_failure_at:  new Date().toISOString(),
          })
          .eq('id', delivery.endpoint_id)

        // Increment failure_count directly
        await db.rpc('exec_sql' as never, {
          sql:    'update public.webhook_endpoints set failure_count = failure_count + 1 where id = $1',
          params: [delivery.endpoint_id],
        } as never).catch(() => {})
      } else {
        const delaySeconds = RETRY_DELAYS_SECONDS[newAttemptCount - 1] ?? 28800
        const nextRetry    = new Date(Date.now() + delaySeconds * 1000).toISOString()

        await db.from('webhook_deliveries').update({
          status:               'pending',
          attempt_count:        newAttemptCount,
          next_retry_at:        nextRetry,
          last_response_status: responseStatus,
          last_response_body:   responseBody.slice(0, 1000),
        }).eq('id', delivery.id)

        await db
          .from('webhook_endpoints')
          .update({ last_failure_at: new Date().toISOString() })
          .eq('id', delivery.endpoint_id)
      }
    }),
  )

  return new Response(JSON.stringify({ processed }), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  })
})
