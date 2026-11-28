/** oauth-connect is unavailable until the integration security requirements are implemented.
 * See docs/site-review-rounds.md. Do not restore the prototype handler for deployment.
 */
import { corsResponse, errorResponse } from '../_shared/cors.ts'

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return corsResponse()
  return errorResponse('External integrations are not available.', 503)
})
