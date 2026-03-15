import { useRef, useState } from 'react'
import { createRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { AppButton, AppCard, AppInput, AppPanel, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { IntegrationConnectButton } from '@/components/integration-connect-button'
import {
  createApiKey,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  disconnectIntegration,
  fetchApiKeys,
  fetchConnectedIntegrations,
  fetchWebhookDeliveries,
  fetchWebhookEndpoints,
  revokeApiKey,
  updateWebhookEndpoint,
} from '@/lib/integrations'
import type { IntegrationProvider, WebhookEndpoint } from '@superapp/types'

const ALL_SCOPES = ['orders:read', 'schedules:read', 'shifts:write'] as const
type Scope = typeof ALL_SCOPES[number]

const SHIFTLY_SCOPES: Scope[] = ['orders:read', 'schedules:read', 'shifts:write']
const SHIFTLY_EVENTS = ['order.placed', 'order.paid', 'order.fulfilled', 'booking.created']

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function PaymentProvidersSection() {
  const queryClient     = useQueryClient()
  const integrationsQuery = useQuery({
    queryKey: ['connected-integrations'],
    queryFn:  fetchConnectedIntegrations,
  })
  const disconnectMutation = useMutation({
    mutationFn: (provider: IntegrationProvider) => disconnectIntegration(provider),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['connected-integrations'] }),
  })

  const integrations   = integrationsQuery.data ?? []
  const statusOf = (p: IntegrationProvider) =>
    integrations.find((i) => i.provider === p)?.status ?? null

  const paymentProviders: Array<{ provider: IntegrationProvider; label: string; description: string }> = [
    { provider: 'stripe',         label: 'Stripe',         description: 'Accept card payments via Stripe Connect' },
    { provider: 'paypal',         label: 'PayPal',         description: 'Accept PayPal and card payments' },
    { provider: 'openwallex',     label: 'OpenWallex',     description: 'Accept multi-currency B2B payments' },
    { provider: 'direct_banking', label: 'Direct Banking', description: 'Australian bank transfers (BSB/account)' },
  ]

  return (
    <AppCard className="space-y-4">
      <SectionHeading eyebrow="Commerce" title="Payment providers" />
      <div className="grid gap-3">
        {paymentProviders.map(({ provider, label, description }) => {
          const status = statusOf(provider)
          const connectedRow = integrations.find((i) => i.provider === provider)
          return (
            <AppPanel key={provider} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-ink">{label}</p>
                <p className="text-xs text-ink/60">{description}</p>
                {connectedRow?.providerAccountLabel ? (
                  <p className="mt-0.5 text-xs font-bold text-teal">{connectedRow.providerAccountLabel}</p>
                ) : null}
              </div>
              <IntegrationConnectButton
                provider={provider}
                isConnected={status === 'active'}
                onDisconnect={() => disconnectMutation.mutate(provider)}
              />
            </AppPanel>
          )
        })}
      </div>
    </AppCard>
  )
}

function AccountingSection() {
  const queryClient = useQueryClient()
  const integrationsQuery = useQuery({
    queryKey: ['connected-integrations'],
    queryFn:  fetchConnectedIntegrations,
  })
  const disconnectMutation = useMutation({
    mutationFn: (provider: IntegrationProvider) => disconnectIntegration(provider),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['connected-integrations'] }),
  })

  const integrations = integrationsQuery.data ?? []
  const statusOf = (p: IntegrationProvider) =>
    integrations.find((i) => i.provider === p)?.status ?? null

  const providers: Array<{ provider: IntegrationProvider; label: string }> = [
    { provider: 'xero', label: 'Xero' },
    { provider: 'myob', label: 'MYOB' },
  ]

  return (
    <AppCard className="space-y-4">
      <SectionHeading eyebrow="Finance" title="Accounting" />
      <div className="grid gap-3">
        {providers.map(({ provider, label }) => {
          const status   = statusOf(provider)
          const row      = integrations.find((i) => i.provider === provider)
          const syncFnId = provider === 'xero' ? 'xero-sync' : 'myob-sync'
          return (
            <AppPanel key={provider} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-ink">{label}</p>
                {row?.updatedAt ? (
                  <p className="text-xs text-ink/55">Last sync: {new Date(row.updatedAt).toLocaleDateString()}</p>
                ) : (
                  <p className="text-xs text-ink/55">Not yet synced</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {status === 'active' ? (
                  <SyncNowButton functionId={syncFnId} />
                ) : null}
                <IntegrationConnectButton
                  provider={provider}
                  isConnected={status === 'active'}
                  onDisconnect={() => disconnectMutation.mutate(provider)}
                />
              </div>
            </AppPanel>
          )
        })}
      </div>
    </AppCard>
  )
}

function SyncNowButton({ functionId }: { functionId: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<string | null>(null)

  async function sync() {
    setLoading(true)
    setResult(null)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const res = await fetch(`${supabaseUrl}/functions/v1/${functionId}`, { method: 'POST' })
      const json = await res.json() as { synced: number }
      setResult(`${json.synced} synced`)
    } catch {
      setResult('Sync failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result ? <span className="text-xs text-ink/60">{result}</span> : null}
      <AppButton variant="ghost" onClick={() => void sync()} disabled={loading}>
        {loading ? 'Syncing…' : 'Sync now'}
      </AppButton>
    </div>
  )
}

function ShiftlySection() {
  const queryClient     = useQueryClient()
  const keysQuery       = useQuery({ queryKey: ['api-keys'], queryFn: fetchApiKeys })
  const endpointsQuery  = useQuery({ queryKey: ['webhook-endpoints'], queryFn: fetchWebhookEndpoints })

  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [endpointUrl, setEndpointUrl] = useState('')

  const createKeyMutation = useMutation({
    mutationFn: () => createApiKey(`Shiftly — ${newKeyName || 'default'}`, SHIFTLY_SCOPES),
    onSuccess: (result) => {
      setCreatedKey(result.apiKey)
      setNewKeyName('')
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  const createEndpointMutation = useMutation({
    mutationFn: () => createWebhookEndpoint(endpointUrl, 'Shiftly webhook', SHIFTLY_EVENTS),
    onSuccess: () => {
      setEndpointUrl('')
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] })
    },
  })

  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null)
  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      setRevokeConfirmId(null)
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  const [removeEndpointConfirmId, setRemoveEndpointConfirmId] = useState<string | null>(null)
  const removeEndpointMutation = useMutation({
    mutationFn: (id: string) => deleteWebhookEndpoint(id),
    onSuccess: () => {
      setRemoveEndpointConfirmId(null)
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] })
    },
  })

  const shiftlyKeys = (keysQuery.data ?? []).filter((k) =>
    k.scopes.includes('shifts:write'),
  )
  const shiftlyEndpoints = (endpointsQuery.data ?? []).filter((e) =>
    e.eventTypes.some((t) => SHIFTLY_EVENTS.includes(t)),
  )

  return (
    <AppCard className="space-y-4">
      <SectionHeading eyebrow="Integrations" title="Shiftly" />
      <p className="text-sm text-ink/65">
        Shiftly uses an API key to read orders and schedules, and POST shift completions.
        Scopes: <code className="text-xs">orders:read, schedules:read, shifts:write</code>
      </p>

      <div className="space-y-3">
        <p className="text-sm font-bold text-ink">API keys</p>
        {shiftlyKeys.map((key) => (
          <AppPanel key={key.id} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-ink">{key.name}</p>
              <p className="text-xs text-ink/55">{key.keyPrefix}… · last used {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'never'}</p>
            </div>
            {revokeConfirmId === key.id ? (
              <span className="flex items-center gap-1">
                <span className="text-xs font-bold text-berry">Revoke?</span>
                <AppButton variant="secondary" onClick={() => revokeKeyMutation.mutate(key.id)} disabled={revokeKeyMutation.isPending}>Yes</AppButton>
                <AppButton variant="ghost" onClick={() => setRevokeConfirmId(null)}>Cancel</AppButton>
              </span>
            ) : (
              <AppButton variant="ghost" onClick={() => setRevokeConfirmId(key.id)}>Revoke</AppButton>
            )}
          </AppPanel>
        ))}
        {!shiftlyKeys.length ? <p className="text-sm text-ink/55">No Shiftly keys yet.</p> : null}

        {createdKey ? (
          <AppPanel tone="butter" className="space-y-2">
            <p className="text-sm font-bold text-ink">API key created — copy it now, it won't be shown again</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all text-xs text-ink">{createdKey}</code>
              <AppButton variant="ghost" onClick={() => void navigator.clipboard.writeText(createdKey)}>
                Copy
              </AppButton>
            </div>
            <AppButton variant="ghost" onClick={() => setCreatedKey(null)}>Dismiss</AppButton>
          </AppPanel>
        ) : null}

        <div className="flex gap-2">
          <AppInput
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key label (optional)"
            className="flex-1"
          />
          <AppButton
            onClick={() => createKeyMutation.mutate()}
            disabled={createKeyMutation.isPending}
          >
            Create key
          </AppButton>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-bold text-ink">Webhook endpoint</p>
        {shiftlyEndpoints.map((ep) => (
          <AppPanel key={ep.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="break-all text-sm text-ink">{ep.url}</p>
              <p className="text-xs text-ink/55">
                {ep.isActive ? 'Active' : 'Paused'} · {ep.failureCount} failures
              </p>
            </div>
            {removeEndpointConfirmId === ep.id ? (
              <span className="flex items-center gap-1">
                <span className="text-xs font-bold text-berry">Remove?</span>
                <AppButton variant="secondary" onClick={() => removeEndpointMutation.mutate(ep.id)} disabled={removeEndpointMutation.isPending}>Yes</AppButton>
                <AppButton variant="ghost" onClick={() => setRemoveEndpointConfirmId(null)}>Cancel</AppButton>
              </span>
            ) : (
              <AppButton variant="ghost" onClick={() => setRemoveEndpointConfirmId(ep.id)}>Remove</AppButton>
            )}
          </AppPanel>
        ))}
        <div className="flex gap-2">
          <AppInput
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            placeholder="https://api.shiftly.app/webhooks/superapp"
            className="flex-1"
          />
          <AppButton
            onClick={() => createEndpointMutation.mutate()}
            disabled={!endpointUrl || createEndpointMutation.isPending}
          >
            Add
          </AppButton>
        </div>
      </div>
    </AppCard>
  )
}

function DeveloperApiSection() {
  const queryClient    = useQueryClient()
  const keysQuery      = useQuery({ queryKey: ['api-keys'], queryFn: fetchApiKeys })
  const endpointsQuery = useQuery({ queryKey: ['webhook-endpoints'], queryFn: fetchWebhookEndpoints })

  const [showCreateKey, setShowCreateKey]   = useState(false)
  const [keyName, setKeyName]               = useState('')
  const [selectedScopes, setSelectedScopes] = useState<Scope[]>([])
  const [createdKey, setCreatedKey]         = useState<string | null>(null)
  const [deliveryEndpoint, setDeliveryEndpoint] = useState<WebhookEndpoint | null>(null)

  const [newEndpointUrl, setNewEndpointUrl]         = useState('')
  const [newEndpointDesc, setNewEndpointDesc]       = useState('')
  const [newEndpointEvents, setNewEndpointEvents]   = useState('')
  const [editingEndpointId, setEditingEndpointId]   = useState<string | null>(null)
  const [editEndpointField, setEditEndpointField]   = useState<'url' | 'description' | null>(null)
  const [editEndpointValue, setEditEndpointValue]   = useState('')
  const [deleteConfirmEndpointId, setDeleteConfirmEndpointId] = useState<string | null>(null)
  const endpointEditRef = useRef<HTMLInputElement>(null)

  const createKeyMutation = useMutation({
    mutationFn: () => createApiKey(keyName, selectedScopes),
    onSuccess: (result) => {
      setCreatedKey(result.apiKey)
      setShowCreateKey(false)
      setKeyName('')
      setSelectedScopes([])
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  const createEndpointMutation = useMutation({
    mutationFn: () =>
      createWebhookEndpoint(
        newEndpointUrl,
        newEndpointDesc,
        newEndpointEvents.split(',').map((s) => s.trim()).filter(Boolean),
      ),
    onSuccess: () => {
      setNewEndpointUrl('')
      setNewEndpointDesc('')
      setNewEndpointEvents('')
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] })
    },
  })

  const updateEndpointMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { url?: string; description?: string } }) =>
      updateWebhookEndpoint(id, patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] }),
  })

  const deleteEndpointMutation = useMutation({
    mutationFn: (id: string) => deleteWebhookEndpoint(id),
    onSuccess: () => {
      setDeleteConfirmEndpointId(null)
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] })
    },
  })

  function beginEndpointEdit(ep: WebhookEndpoint, field: 'url' | 'description') {
    setEditingEndpointId(ep.id)
    setEditEndpointField(field)
    setEditEndpointValue(field === 'url' ? ep.url : ep.description)
    setTimeout(() => endpointEditRef.current?.select(), 0)
  }

  function commitEndpointEdit(ep: WebhookEndpoint) {
    if (!editEndpointValue.trim()) { cancelEndpointEdit(); return }
    const patch = editEndpointField === 'url' ? { url: editEndpointValue.trim() } : { description: editEndpointValue.trim() }
    updateEndpointMutation.mutate({ id: ep.id, patch })
    cancelEndpointEdit()
  }

  function cancelEndpointEdit() {
    setEditingEndpointId(null)
    setEditEndpointField(null)
    setEditEndpointValue('')
  }

  function toggleScope(scope: Scope) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    )
  }

  const genericEndpoints = (endpointsQuery.data ?? []).filter(
    (e) => !e.eventTypes.some((t) => SHIFTLY_EVENTS.includes(t)),
  )

  return (
    <AppCard className="space-y-4">
      <SectionHeading eyebrow="Developer" title="API keys & webhooks" />

      {/* API keys table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-ink">API keys</p>
          <AppButton variant="ghost" onClick={() => setShowCreateKey(true)}>Create key</AppButton>
        </div>

        {createdKey ? (
          <AppPanel tone="butter" className="space-y-2">
            <p className="text-sm font-bold text-ink">Save this key — it won't be shown again</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all text-xs">{createdKey}</code>
              <AppButton variant="ghost" onClick={() => void navigator.clipboard.writeText(createdKey)}>Copy</AppButton>
            </div>
            <AppButton variant="ghost" onClick={() => setCreatedKey(null)}>Dismiss</AppButton>
          </AppPanel>
        ) : null}

        {showCreateKey ? (
          <AppPanel className="space-y-3">
            <AppInput value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Key name" />
            <div className="flex flex-wrap gap-2">
              {ALL_SCOPES.map((scope) => (
                <button
                  key={scope}
                  onClick={() => toggleScope(scope)}
                  className={selectedScopes.includes(scope) ? 'ui-chip-toggle ui-chip-toggle--active' : 'ui-chip-toggle ui-chip-toggle--inactive'}
                >
                  {scope}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <AppButton onClick={() => createKeyMutation.mutate()} disabled={!keyName || createKeyMutation.isPending}>
                Generate
              </AppButton>
              <AppButton variant="ghost" onClick={() => setShowCreateKey(false)}>Cancel</AppButton>
            </div>
          </AppPanel>
        ) : null}

        <div className="grid gap-2">
          {(keysQuery.data ?? []).map((key) => (
            <AppPanel key={key.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-ink">{key.name}</p>
                <p className="text-xs text-ink/55">
                  {key.keyPrefix}… · {key.scopes.join(', ')} · last used {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'never'}
                </p>
              </div>
              <AppButton variant="ghost" onClick={() => void revokeApiKey(key.id).then(() => queryClient.invalidateQueries({ queryKey: ['api-keys'] }))}>
                Revoke
              </AppButton>
            </AppPanel>
          ))}
          {!keysQuery.data?.length ? <p className="text-sm text-ink/55">No API keys yet.</p> : null}
        </div>
      </div>

      {/* Webhook endpoints */}
      <div className="space-y-2">
        <p className="text-sm font-bold text-ink">Webhook endpoints</p>
        <div className="grid gap-2">
          {genericEndpoints.map((ep) => (
            <AppPanel key={ep.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* URL — double-click to edit */}
                  {editingEndpointId === ep.id && editEndpointField === 'url' ? (
                    <input
                      ref={endpointEditRef}
                      value={editEndpointValue}
                      onChange={(e) => setEditEndpointValue(e.target.value)}
                      onBlur={() => commitEndpointEdit(ep)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEndpointEdit(ep); if (e.key === 'Escape') cancelEndpointEdit() }}
                      className="w-full bg-transparent text-sm font-bold text-ink outline-none border-b border-ink/40 focus:border-ink"
                    />
                  ) : (
                    <p
                      className="break-all text-sm font-bold text-ink cursor-text group/url flex items-center gap-1"
                      onDoubleClick={() => beginEndpointEdit(ep, 'url')}
                      title="Double-click to edit URL"
                    >
                      <span className="break-all">{ep.url}</span>
                      <Pencil className="h-2.5 w-2.5 shrink-0 text-ink/30 opacity-0 group-hover/url:opacity-100 transition-opacity" />
                    </p>
                  )}
                  {/* Description — double-click to edit */}
                  {editingEndpointId === ep.id && editEndpointField === 'description' ? (
                    <input
                      ref={editEndpointField === 'description' ? endpointEditRef : undefined}
                      value={editEndpointValue}
                      onChange={(e) => setEditEndpointValue(e.target.value)}
                      onBlur={() => commitEndpointEdit(ep)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEndpointEdit(ep); if (e.key === 'Escape') cancelEndpointEdit() }}
                      className="bg-transparent text-xs text-ink outline-none border-b border-ink/30 focus:border-ink"
                    />
                  ) : (
                    <p
                      className="mt-0.5 text-xs text-ink/55 cursor-text group/desc flex items-center gap-1"
                      onDoubleClick={() => beginEndpointEdit(ep, 'description')}
                      title="Double-click to edit description"
                    >
                      <span>{ep.description || 'No description'}</span>
                      <Pencil className="h-2 w-2 shrink-0 text-ink/30 opacity-0 group-hover/desc:opacity-100 transition-opacity" />
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-ink/40">
                    {ep.eventTypes.join(', ') || 'all events'} · {ep.isActive ? 'active' : 'paused'} · {ep.failureCount} failures
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AppButton variant="ghost" onClick={() => setDeliveryEndpoint(deliveryEndpoint?.id === ep.id ? null : ep)}>
                    Logs
                  </AppButton>
                  <AppButton
                    variant="ghost"
                    onClick={() => void updateWebhookEndpoint(ep.id, { isActive: !ep.isActive }).then(() => queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] }))}
                  >
                    {ep.isActive ? 'Pause' : 'Enable'}
                  </AppButton>
                  {deleteConfirmEndpointId === ep.id ? (
                    <>
                      <span className="flex items-center text-xs font-bold text-berry">Delete?</span>
                      <AppButton variant="secondary" onClick={() => deleteEndpointMutation.mutate(ep.id)} disabled={deleteEndpointMutation.isPending}>
                        Yes, delete
                      </AppButton>
                      <AppButton variant="ghost" onClick={() => setDeleteConfirmEndpointId(null)}>Cancel</AppButton>
                    </>
                  ) : (
                    <AppButton variant="ghost" onClick={() => setDeleteConfirmEndpointId(ep.id)}>Delete</AppButton>
                  )}
                </div>
              </div>
              {deliveryEndpoint?.id === ep.id ? <DeliveryLog endpointId={ep.id} /> : null}
            </AppPanel>
          ))}
          {!genericEndpoints.length ? <p className="text-sm text-ink/55">No webhook endpoints yet.</p> : null}
        </div>

        <AppPanel className="space-y-3">
          <p className="text-sm font-bold text-ink">Add endpoint</p>
          <AppInput value={newEndpointUrl} onChange={(e) => setNewEndpointUrl(e.target.value)} placeholder="https://yourapp.com/webhooks" />
          <AppInput value={newEndpointDesc} onChange={(e) => setNewEndpointDesc(e.target.value)} placeholder="Description" />
          <AppInput value={newEndpointEvents} onChange={(e) => setNewEndpointEvents(e.target.value)} placeholder="order.placed, order.paid (or * for all)" />
          <AppButton onClick={() => createEndpointMutation.mutate()} disabled={!newEndpointUrl || createEndpointMutation.isPending}>
            Add endpoint
          </AppButton>
        </AppPanel>
      </div>
    </AppCard>
  )
}

function DeliveryLog({ endpointId }: { endpointId: string }) {
  const deliveriesQuery = useQuery({
    queryKey: ['webhook-deliveries', endpointId],
    queryFn:  () => fetchWebhookDeliveries(endpointId),
  })

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-ink/40">Recent deliveries</p>
      {(deliveriesQuery.data ?? []).map((d) => (
        <div key={d.id} className="grid grid-cols-[auto_1fr_auto] gap-x-3 text-xs text-ink/70">
          <span className={d.status === 'delivered' ? 'font-bold text-teal' : d.status === 'abandoned' ? 'font-bold text-berry' : 'text-ink/50'}>
            {d.status}
          </span>
          <span className="truncate">{d.eventType}</span>
          <span>{d.lastResponseStatus ?? '—'}</span>
        </div>
      ))}
      {!deliveriesQuery.data?.length ? <p className="text-xs text-ink/50">No deliveries yet.</p> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function IntegrationsPage() {
  return (
    <div className="space-y-4">
      <AppCard className="p-0">
        <div className="px-6 py-4">
          <SectionHeading eyebrow="Settings" title="Integrations" />
          <p className="mt-1 text-sm text-ink/65">
            Connect payment providers, accounting software, and developer API access.
          </p>
        </div>
      </AppCard>
      <PaymentProvidersSection />
      <AccountingSection />
      <ShiftlySection />
      <DeveloperApiSection />
    </div>
  )
}

export const integrationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path:           'integrations',
  component:      IntegrationsPage,
})
