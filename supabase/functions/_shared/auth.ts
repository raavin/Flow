import { createClient } from 'jsr:@supabase/supabase-js@2'
import { createServiceClient } from './db.ts'

export interface ApiKeyIdentity {
  profileId: string
  scopes: string[]
  keyId: string
}

/**
 * Verify a Bearer `sa_live_...` API key.
 * Calls the SECURITY DEFINER RPC `verify_integration_api_key`.
 * Returns null if invalid/expired.
 */
export async function verifyApiKey(req: Request): Promise<ApiKeyIdentity | null> {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer sa_live_')) return null
  const rawKey = auth.slice(7)

  const db = createServiceClient()
  const { data, error } = await db.rpc('verify_integration_api_key', { p_raw_key: rawKey })
  if (error || !data) return null

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.profile_id) return null

  return {
    profileId: row.profile_id as string,
    scopes: (row.scopes as string[]) ?? [],
    keyId: row.key_id as string,
  }
}

/**
 * Verify the Supabase Auth JWT from the Authorization header.
 * Returns the user object or null.
 */
export async function verifyJwt(req: Request) {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) return null

  const authHeader = req.headers.get('authorization') ?? ''
  const client = createClient(url, anonKey, {
    global: { headers: { authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: { user } } = await client.auth.getUser()
  return user ?? null
}
