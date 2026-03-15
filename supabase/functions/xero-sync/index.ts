/**
 * xero-sync — sync paid financial_transactions to Xero.
 * Scheduled daily. Called via cron or manually via POST.
 */

import { createServiceClient } from '../_shared/db.ts'
import { refreshXeroToken, XERO_API_BASE, buildXeroInvoice } from '../_shared/providers/xero.ts'

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    const provided = req.headers.get('x-cron-secret') ?? ''
    if (provided !== cronSecret) return new Response('Forbidden', { status: 403 })
  }

  const db         = createServiceClient()
  const clientId   = Deno.env.get('XERO_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('XERO_CLIENT_SECRET') ?? ''

  // Find all Xero-connected profiles
  const { data: integrations } = await db
    .from('connected_integrations')
    .select('profile_id, oauth_refresh_token_secret_id, provider_account_id')
    .eq('provider', 'xero')
    .eq('status', 'active')

  if (!integrations?.length) {
    return new Response(JSON.stringify({ synced: 0 }), { status: 200 })
  }

  let totalSynced = 0

  for (const integ of integrations) {
    if (!integ.oauth_refresh_token_secret_id) continue

    // Fetch refresh token from vault
    const { data: secretRow } = await db
      .from('vault.decrypted_secrets')
      .select('decrypted_secret')
      .eq('id', integ.oauth_refresh_token_secret_id)
      .single()

    const refreshToken = (secretRow as { decrypted_secret: string } | null)?.decrypted_secret
    if (!refreshToken) continue

    let accessToken: string
    try {
      const tokens = await refreshXeroToken(clientId, clientSecret, refreshToken)
      accessToken  = tokens.access_token
      // Store new refresh token back to vault
      await db.rpc('store_oauth_tokens', {
        p_provider:      'xero',
        p_access_token:  tokens.access_token,
        p_refresh_token: tokens.refresh_token,
        p_expires_at:    new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      })
    } catch (err) {
      console.error('Xero token refresh failed for profile', integ.profile_id, err)
      await db
        .from('connected_integrations')
        .update({ status: 'error' })
        .eq('profile_id', integ.profile_id)
        .eq('provider', 'xero')
      continue
    }

    // Find unsynced paid transactions for this profile
    const { data: txns } = await db
      .from('financial_transactions')
      .select('id, direction, description, counterparty_label, total_cents, currency_code, occurred_at')
      .eq('profile_id', integ.profile_id)
      .eq('status', 'paid')
      .is('external_sync_ids->xero', null)
      .limit(100)

    if (!txns?.length) continue

    const tenantId = integ.provider_account_id ?? ''

    for (const txn of txns) {
      const invoiceType = txn.direction === 'in' ? 'ACCREC' : 'ACCPAY'
      const invoice     = buildXeroInvoice({
        contactName:  txn.counterparty_label,
        date:         txn.occurred_at,
        lineItems: [{
          Description: txn.description,
          Quantity:     1,
          UnitAmount:   txn.total_cents / 100,
        }],
        currencyCode: txn.currency_code,
        reference:    txn.id,
        type:         invoiceType,
      })

      try {
        const xeroRes = await fetch(`${XERO_API_BASE}/Invoices`, {
          method: 'POST',
          headers: {
            Authorization:   `Bearer ${accessToken}`,
            'Xero-tenant-id': tenantId,
            'Content-Type':  'application/json',
            Accept:          'application/json',
          },
          body: JSON.stringify({ Invoices: [invoice] }),
        })

        if (!xeroRes.ok) {
          console.error('Xero invoice create failed:', await xeroRes.text())
          continue
        }

        const xeroData = await xeroRes.json() as {
          Invoices: Array<{ InvoiceID: string }>
        }
        const xeroId = xeroData.Invoices?.[0]?.InvoiceID
        if (!xeroId) continue

        await db
          .from('financial_transactions')
          .update({
            external_sync_ids: { xero: xeroId },
          })
          .eq('id', txn.id)

        totalSynced++
      } catch (err) {
        console.error('Xero sync error for transaction', txn.id, err)
      }
    }
  }

  return new Response(JSON.stringify({ synced: totalSynced }), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  })
})
