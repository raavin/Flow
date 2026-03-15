import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AppButton } from '@superapp/ui'
import type { IntegrationProvider } from '@superapp/types'
import { supabase } from '@/lib/supabase'

interface Props {
  provider: IntegrationProvider
  isConnected: boolean
  onDisconnect?: () => void
}

const PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  stripe:         'Stripe',
  paypal:         'PayPal',
  openwallex:     'OpenWallex',
  direct_banking: 'Direct Banking',
  xero:           'Xero',
  myob:           'MYOB',
  shiftly:        'Shiftly',
  generic:        'Generic',
}

export function IntegrationConnectButton({ provider, isConnected, onDisconnect }: Props) {
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const queryClient                     = useQueryClient()

  async function startOAuth() {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase!.auth.getSession()
      if (!session) throw new Error('Not signed in')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const res = await fetch(
        `${supabaseUrl}/functions/v1/oauth-connect?provider=${provider}`,
        {
          headers: {
            Authorization:    `Bearer ${session.access_token}`,
            apikey:           import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          },
        },
      )
      if (!res.ok) throw new Error(await res.text())

      const { url } = await res.json() as { url: string }
      const popup = window.open(url, `connect_${provider}`, 'width=640,height=720')

      // Poll connected_integrations until status transitions from pending_oauth → active
      const pollInterval = setInterval(() => {
        void queryClient.invalidateQueries({ queryKey: ['connected-integrations'] })
      }, 2000)

      // Stop polling when popup closes or after 5 minutes
      const stopPoll = () => {
        clearInterval(pollInterval)
        setLoading(false)
      }

      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          stopPoll()
          clearInterval(checkClosed)
        }
      }, 500)

      setTimeout(() => {
        stopPoll()
        clearInterval(checkClosed)
      }, 5 * 60 * 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
      setLoading(false)
    }
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-teal">Connected</span>
        {confirmDisconnect ? (
          <>
            <span className="text-xs font-bold text-berry">Disconnect {PROVIDER_LABELS[provider]}?</span>
            <AppButton variant="secondary" onClick={() => { setConfirmDisconnect(false); onDisconnect?.() }}>
              Yes
            </AppButton>
            <AppButton variant="ghost" onClick={() => setConfirmDisconnect(false)}>
              Cancel
            </AppButton>
          </>
        ) : (
          <AppButton variant="ghost" onClick={() => setConfirmDisconnect(true)}>
            Disconnect
          </AppButton>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <AppButton onClick={() => void startOAuth()} disabled={loading}>
        {loading ? 'Connecting…' : `Connect ${PROVIDER_LABELS[provider]}`}
      </AppButton>
      {error ? <p className="text-xs text-berry">{error}</p> : null}
    </div>
  )
}
