export const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
export const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0'

export interface XeroTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export async function refreshXeroToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<XeroTokenResponse> {
  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) throw new Error(`Xero token refresh failed: ${res.status}`)
  return res.json() as Promise<XeroTokenResponse>
}

export interface XeroLineItem {
  Description: string
  Quantity: number
  UnitAmount: number
  AccountCode?: string
  TaxType?: string
}

export function buildXeroInvoice(params: {
  contactName: string
  date: string
  lineItems: XeroLineItem[]
  currencyCode: string
  reference?: string
  type: 'ACCREC' | 'ACCPAY'
}) {
  return {
    Type: params.type,
    Contact: { Name: params.contactName },
    Date: params.date.slice(0, 10),
    DueDate: params.date.slice(0, 10),
    LineItems: params.lineItems,
    CurrencyCode: params.currencyCode,
    Reference: params.reference ?? '',
    Status: 'SUBMITTED',
  }
}
