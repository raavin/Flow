/**
 * myob-sync — sync paid financial_transactions to MYOB.
 * Scheduled daily. Called via cron or manually via POST.
 */

import { createServiceClient } from '../_shared/db.ts'
import { refreshMyobToken, MYOB_API_BASE, buildMyobGeneralJournalLine } from '../_shared/providers/myob.ts'

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    const provided = req.headers.get('x-cron-secret') ?? ''
    if (provided !== cronSecret) return new Response('Forbidden', { status: 403 })
  }

  const db           = createServiceClient()
  const clientId     = Deno.env.get('MYOB_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('MYOB_CLIENT_SECRET') ?? ''

  const { data: integrations } = await db
    .from('connected_integrations')
    .select('profile_id, oauth_refresh_token_secret_id, provider_account_id, metadata')
    .eq('provider', 'myob')
    .eq('status', 'active')

  if (!integrations?.length) {
    return new Response(JSON.stringify({ synced: 0 }), { status: 200 })
  }

  let totalSynced = 0

  for (const integ of integrations) {
    if (!integ.oauth_refresh_token_secret_id) continue

    const { data: secretRow } = await db
      .from('vault.decrypted_secrets')
      .select('decrypted_secret')
      .eq('id', integ.oauth_refresh_token_secret_id)
      .single()

    const refreshToken = (secretRow as { decrypted_secret: string } | null)?.decrypted_secret
    if (!refreshToken) continue

    let accessToken: string
    try {
      const tokens = await refreshMyobToken(clientId, clientSecret, refreshToken)
      accessToken  = tokens.access_token
      await db.rpc('store_oauth_tokens', {
        p_provider:      'myob',
        p_access_token:  tokens.access_token,
        p_refresh_token: tokens.refresh_token,
        p_expires_at:    new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      })
    } catch (err) {
      console.error('MYOB token refresh failed for profile', integ.profile_id, err)
      await db
        .from('connected_integrations')
        .update({ status: 'error' })
        .eq('profile_id', integ.profile_id)
        .eq('provider', 'myob')
      continue
    }

    const companyFileId = (integ.metadata as Record<string, string> | null)?.company_file_id ?? ''
    if (!companyFileId) continue

    const { data: txns } = await db
      .from('financial_transactions')
      .select('id, direction, description, total_cents, currency_code, occurred_at')
      .eq('profile_id', integ.profile_id)
      .eq('status', 'paid')
      .is('external_sync_ids->myob', null)
      .limit(100)

    if (!txns?.length) continue

    const debitAccountId  = (integ.metadata as Record<string, string> | null)?.default_debit_account ?? ''
    const creditAccountId = (integ.metadata as Record<string, string> | null)?.default_credit_account ?? ''
    if (!debitAccountId || !creditAccountId) continue

    for (const txn of txns) {
      const amount = txn.total_cents / 100
      const lines  = [
        buildMyobGeneralJournalLine({ accountId: debitAccountId,  amount, isCredit: false, memo: txn.description }),
        buildMyobGeneralJournalLine({ accountId: creditAccountId, amount, isCredit: true,  memo: txn.description }),
      ]

      try {
        const myobRes = await fetch(
          `${MYOB_API_BASE}/${companyFileId}/GeneralLedger/GeneralJournal`,
          {
            method:  'POST',
            headers: {
              Authorization:  `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'x-myobapi-key': clientId,
            },
            body: JSON.stringify({ Lines: lines, DateOccurred: txn.occurred_at.slice(0, 10) }),
          },
        )

        if (!myobRes.ok) {
          console.error('MYOB journal create failed:', await myobRes.text())
          continue
        }

        const location = myobRes.headers.get('location') ?? ''
        const myobId   = location.split('/').pop() ?? txn.id

        await db
          .from('financial_transactions')
          .update({ external_sync_ids: { myob: myobId } })
          .eq('id', txn.id)

        totalSynced++
      } catch (err) {
        console.error('MYOB sync error for transaction', txn.id, err)
      }
    }
  }

  return new Response(JSON.stringify({ synced: totalSynced }), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  })
})
