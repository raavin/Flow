export const MYOB_TOKEN_URL = 'https://secure.myob.com/oauth2/v1/authorize'
export const MYOB_API_BASE = 'https://api.myob.com/accountright'

export interface MyobTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export async function refreshMyobToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<MyobTokenResponse> {
  const res = await fetch('https://secure.myob.com/oauth2/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) throw new Error(`MYOB token refresh failed: ${res.status}`)
  return res.json() as Promise<MyobTokenResponse>
}

export function buildMyobGeneralJournalLine(params: {
  accountId: string
  amount: number
  isCredit: boolean
  memo: string
}) {
  return {
    Account: { UID: params.accountId },
    Amount: params.amount,
    IsCredit: params.isCredit,
    Memo: params.memo,
  }
}
