/**
 * oauth-connect — initiate an OAuth PKCE flow for a provider.
 * GET /functions/v1/oauth-connect?provider=stripe|xero|myob|paypal
 * Auth: Supabase JWT (user must be signed in)
 * Returns: { url: string }
 */

import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { verifyJwt } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/db.ts'

const PROVIDER_AUTH_URLS: Record<string, string> = {
  stripe:  'https://connect.stripe.com/oauth/authorize',
  xero:    'https://login.xero.com/identity/connect/authorize',
  myob:    'https://secure.myob.com/oauth2/account/authorize',
  paypal:  'https://www.paypal.com/connect',
}

const PROVIDER_CLIENT_IDS: Record<string, string> = {
  stripe:  'STRIPE_CLIENT_ID',
  xero:    'XERO_CLIENT_ID',
  myob:    'MYOB_CLIENT_ID',
  paypal:  'PAYPAL_CLIENT_ID',
}

const PROVIDER_SCOPES: Record<string, string> = {
  stripe:  'read_write',
  xero:    'openid profile email accounting.transactions accounting.contacts offline_access',
  myob:    'CompanyFile',
  paypal:  'openid profile email https://uri.paypal.com/services/invoicing',
}

async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const enc     = new TextEncoder()
  const digest  = await crypto.subtle.digest('SHA-256', enc.encode(verifier))
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  return { verifier, challenge }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  const user = await verifyJwt(req)
  if (!user) return errorResponse('Unauthorized', 401)

  const url      = new URL(req.url)
  const provider = url.searchParams.get('provider') ?? ''

  if (!PROVIDER_AUTH_URLS[provider]) {
    return errorResponse(`Unknown provider: ${provider}`, 400)
  }

  const clientIdEnvVar = PROVIDER_CLIENT_IDS[provider]
  const clientId       = Deno.env.get(clientIdEnvVar) ?? ''
  const redirectUri    = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`

  const { verifier, challenge } = await generatePkce()
  const state = `${user.id}:${provider}`

  const db = createServiceClient()

  // Upsert a pending_oauth row, store pkce_verifier in metadata temporarily
  await db.from('connected_integrations').upsert(
    {
      profile_id: user.id,
      provider,
      status: 'pending_oauth',
      metadata: { pkce_verifier: verifier },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,provider' },
  )

  const authUrl = new URL(PROVIDER_AUTH_URLS[provider])
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', PROVIDER_SCOPES[provider])
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  return jsonResponse({ url: authUrl.toString() })
})
