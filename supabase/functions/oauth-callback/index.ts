/**
 * oauth-callback — exchange the authorization code for tokens.
 * GET /functions/v1/oauth-callback?code=...&state=<profile_id>:<provider>
 * On success, redirects to /app/integrations?provider=<name>&connected=1
 */

import { createServiceClient } from '../_shared/db.ts'

const PROVIDER_TOKEN_URLS: Record<string, string> = {
  stripe:  'https://connect.stripe.com/oauth/token',
  xero:    'https://identity.xero.com/connect/token',
  myob:    'https://secure.myob.com/oauth2/v1/token',
  paypal:  'https://api-m.paypal.com/v1/oauth2/token',
}

const PROVIDER_CLIENT_IDS: Record<string, string> = {
  stripe:  'STRIPE_CLIENT_ID',
  xero:    'XERO_CLIENT_ID',
  myob:    'MYOB_CLIENT_ID',
  paypal:  'PAYPAL_CLIENT_ID',
}

const PROVIDER_CLIENT_SECRETS: Record<string, string> = {
  stripe:  'STRIPE_CLIENT_SECRET',
  xero:    'XERO_CLIENT_SECRET',
  myob:    'MYOB_CLIENT_SECRET',
  paypal:  'PAYPAL_CLIENT_SECRET',
}

function redirect(to: string) {
  return Response.redirect(to, 302)
}

Deno.serve(async (req) => {
  const url      = new URL(req.url)
  const code     = url.searchParams.get('code') ?? ''
  const state    = url.searchParams.get('state') ?? ''
  const appBase  = Deno.env.get('APP_BASE_URL') ?? 'http://127.0.0.1:5173'

  if (!code || !state) {
    return redirect(`${appBase}/app/integrations?error=missing_params`)
  }

  const [profileId, provider] = state.split(':')
  if (!profileId || !provider || !PROVIDER_TOKEN_URLS[provider]) {
    return redirect(`${appBase}/app/integrations?error=invalid_state`)
  }

  const db = createServiceClient()

  // Fetch pkce_verifier from the pending row
  const { data: integRow } = await db
    .from('connected_integrations')
    .select('metadata')
    .eq('profile_id', profileId)
    .eq('provider', provider)
    .single()

  const verifier = (integRow?.metadata as Record<string, string> | null)?.pkce_verifier
  if (!verifier) {
    return redirect(`${appBase}/app/integrations?error=no_verifier`)
  }

  const clientId     = Deno.env.get(PROVIDER_CLIENT_IDS[provider]) ?? ''
  const clientSecret = Deno.env.get(PROVIDER_CLIENT_SECRETS[provider]) ?? ''
  const redirectUri  = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`

  // Exchange code for tokens
  const tokenRes = await fetch(PROVIDER_TOKEN_URLS[provider], {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      client_id:     clientId,
      client_secret: clientSecret,
      code_verifier: verifier,
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    console.error('Token exchange failed:', errText)
    return redirect(`${appBase}/app/integrations?error=token_exchange_failed&provider=${provider}`)
  }

  const tokens = await tokenRes.json() as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    scope?: string
    stripe_user_id?: string  // Stripe Connect specific
  }

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null

  const accountId = tokens.stripe_user_id ?? null

  // Store tokens via SECURITY DEFINER function — vault write
  // We call this with service role, impersonating the profile_id via set_config
  await db.rpc('store_oauth_tokens', {
    p_provider:      provider,
    p_access_token:  tokens.access_token,
    p_refresh_token: tokens.refresh_token ?? null,
    p_expires_at:    expiresAt,
    p_scope:         tokens.scope ?? null,
    p_account_id:    accountId,
    p_account_label: accountId ?? null,
  })

  // Remove pkce_verifier from metadata
  await db
    .from('connected_integrations')
    .update({
      metadata:   db.rpc as never, // handled by store_oauth_tokens; just clear verifier
      updated_at: new Date().toISOString(),
    })
    .eq('profile_id', profileId)
    .eq('provider', provider)

  // Patch metadata to remove pkce_verifier directly
  await db.rpc('exec_sql' as never, {
    sql: `
      update public.connected_integrations
      set metadata = metadata - 'pkce_verifier'
      where profile_id = $1 and provider = $2
    `,
    params: [profileId, provider],
  } as never).catch(() => {
    // Non-fatal: verifier is only needed once
  })

  return redirect(`${appBase}/app/integrations?provider=${provider}&connected=1`)
})
