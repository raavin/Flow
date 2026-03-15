/**
 * HMAC-SHA256 helpers for verifying inbound provider webhooks
 * and signing outbound webhook deliveries.
 */

async function importKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function hexEncode(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Sign a payload with HMAC-SHA256 and return the hex digest.
 */
export async function signHmacSha256(secret: string, payload: Uint8Array): Promise<string> {
  const key = await importKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, payload)
  return hexEncode(sig)
}

/**
 * Verify an HMAC-SHA256 signature.
 * `sig` may be a raw hex string or prefixed with "sha256=".
 */
export async function verifyHmacSha256(
  secret: string,
  payload: Uint8Array,
  sig: string,
): Promise<boolean> {
  const expected = await signHmacSha256(secret, payload)
  const actual = sig.startsWith('sha256=') ? sig.slice(7) : sig
  // Constant-time comparison
  if (expected.length !== actual.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i)
  }
  return diff === 0
}
