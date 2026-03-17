import { useMemo, useState, type ReactNode } from 'react'
import { createRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Landmark, Receipt, Repeat, WalletCards, X } from 'lucide-react'
import { AppButton, AppCard, AppInput, AppPanel, AppPill, AppSelect, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { useAppStore } from '@/hooks/useAppStore'
import { formatCurrency } from '@/lib/commerce'
import { fetchProjects } from '@/lib/projects'
import { fetchPeopleDirectory } from '@/lib/social'
import { createWalletEntry, deleteWalletEntry, fetchWalletEntries, settleWalletEntry, updateWalletEntry } from '@/lib/wallet'

type DraftKind = 'transfer' | 'request' | 'manual'
type LedgerFilter = 'all' | 'pending' | 'marketplace' | 'project' | 'sales'

function WalletPage() {
  const { session } = useAppStore()
  const { highlight } = walletRoute.useSearch()
  const queryClient = useQueryClient()
  const entriesQuery = useQuery({ queryKey: ['wallet'], queryFn: fetchWalletEntries })
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const peopleQuery = useQuery({
    queryKey: ['people-directory', session?.user.id],
    queryFn: () => fetchPeopleDirectory(session!.user.id),
    enabled: Boolean(session?.user.id),
  })

  const [draftKind, setDraftKind] = useState<DraftKind>('transfer')
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all')
  const [ledgerProjectId, setLedgerProjectId] = useState('')
  const [draftOpen, setDraftOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [counterpartyQuery, setCounterpartyQuery] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; label: string; handle: string } | null>(null)
  const [reason, setReason] = useState('')
  const [projectId, setProjectId] = useState('')
  const [dueOn, setDueOn] = useState('')

  const createMutation = useMutation({
    mutationFn: () => {
      const direction = draftKind === 'request' ? 'in' : 'out'
      const entryKind = draftKind === 'request' ? 'request' : draftKind === 'manual' ? 'iou' : 'send'
      return createWalletEntry({
        profileId: session!.user.id,
        linkedProjectId: projectId || null,
        relatedProfileId: selectedPerson?.id ?? null,
        entryKind,
        transactionType: draftKind === 'request' ? 'request' : 'transfer',
        sourceKind: selectedPerson ? 'peer' : projectId ? 'project' : 'manual',
        direction,
        amountCents: Math.round(Number(amount || 0) * 100),
        counterparty: selectedPerson?.label || counterpartyQuery || 'Unassigned',
        reason,
        dueOn: dueOn || undefined,
      })
    },
    onSuccess: () => {
      resetDraft()
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
    },
  })

  const settleMutation = useMutation({
    mutationFn: (entryId: string) => settleWalletEntry(entryId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['wallet'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => deleteWalletEntry(entryId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['wallet'] }),
  })

  const editMutation = useMutation({
    mutationFn: ({ entryId, input }: { entryId: string; input: Parameters<typeof updateWalletEntry>[1] }) =>
      updateWalletEntry(entryId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['wallet'] }),
  })

  const entries = entriesQuery.data ?? []
  const pending = entries.filter((entry) => entry.status === 'pending')
  const marketplaceSpendEntries = entries.filter((entry) => entry.sourceKind === 'marketplace' && entry.transactionRole === 'buyer')

  const summary = useMemo(() => {
    const pendingIn = pending.filter((entry) => entry.direction === 'in').reduce((sum, entry) => sum + entry.totalCents, 0)
    const pendingOut = pending.filter((entry) => entry.direction === 'out').reduce((sum, entry) => sum + entry.totalCents, 0)
    const marketplaceSpent = marketplaceSpendEntries.reduce((sum, entry) => sum + entry.totalCents, 0)
    const settledNet = entries.reduce((sum, entry) => sum + (entry.direction === 'in' ? entry.totalCents : -entry.totalCents), 0)
    return { pendingIn, pendingOut, marketplaceSpent, settledNet }
  }, [entries, marketplaceSpendEntries, pending])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (ledgerProjectId && entry.linkedProjectId !== ledgerProjectId) return false
      switch (ledgerFilter) {
        case 'pending':
          return entry.status === 'pending'
        case 'marketplace':
          return entry.sourceKind === 'marketplace'
        case 'project':
          return Boolean(entry.linkedProjectId)
        case 'sales':
          return entry.transactionRole === 'seller'
        default:
          return true
      }
    })
  }, [entries, ledgerFilter, ledgerProjectId])

  const filteredPeople = (peopleQuery.data ?? []).filter((person) => {
    const needle = counterpartyQuery.replace(/^@/, '').trim().toLowerCase()
    if (!needle) return true
    return person.handle.toLowerCase().includes(needle) || (person.display_name || '').toLowerCase().includes(needle)
  })

  function openDraft(kind: DraftKind) {
    setDraftKind(kind)
    setDraftOpen(true)
  }

  function resetDraft() {
    setDraftOpen(false)
    setDraftKind('transfer')
    setAmount('')
    setCounterpartyQuery('')
    setSelectedPerson(null)
    setReason('')
    setProjectId('')
    setDueOn('')
  }

  return (
    <div className="space-y-4">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Transactions" title="Money movement and commerce" />
        <p className="text-sm text-ink/65">
          Marketplace purchases, person-to-person transfers, and project-linked expenses now flow through one shared ledger.
        </p>
        <div className="flex flex-wrap gap-2">
          <AppButton onClick={() => openDraft('transfer')}>New transfer</AppButton>
          <AppButton variant="secondary" onClick={() => openDraft('request')}>
            Request money
          </AppButton>
          <AppButton variant="ghost" onClick={() => openDraft('manual')}>
            Log manual entry
          </AppButton>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={<Repeat className="h-5 w-5" />} label="Pending in" value={formatCurrency(summary.pendingIn)} tone="teal" />
          <SummaryCard icon={<Landmark className="h-5 w-5" />} label="Pending out" value={formatCurrency(summary.pendingOut)} tone="peach" />
          <SummaryCard icon={<Receipt className="h-5 w-5" />} label="Marketplace spend" value={formatCurrency(summary.marketplaceSpent)} tone="butter" />
          <SummaryCard icon={<WalletCards className="h-5 w-5" />} label="Net position" value={formatCurrency(summary.settledNet)} tone="surface" />
        </div>
      </AppCard>

      <AppCard className="space-y-4">
        <SectionHeading
          eyebrow="Transactions"
          title="Transaction ledger"
          action={<AppPill tone={pending.length ? 'butter' : 'teal'}>{pending.length ? `${pending.length} pending` : 'All clear'}</AppPill>}
        />
        <AppPanel tone="surface" className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink/65">
          <span>Purchases, sales, requests, transfers, and project-linked money movement all land in one spreadsheet view.</span>
          <span>
            Pending movement {formatCurrency(summary.pendingIn + summary.pendingOut)} · Marketplace spend {formatCurrency(summary.marketplaceSpent)}
          </span>
        </AppPanel>
        <div className="flex flex-wrap items-center gap-2">
          {([
            ['all', 'All'],
            ['pending', 'Pending'],
            ['marketplace', 'Marketplace'],
            ['project', 'Project-linked'],
            ['sales', 'Sales'],
          ] as Array<[LedgerFilter, string]>).map(([filter, label]) => (
            <button
              key={filter}
              type="button"
              onClick={() => setLedgerFilter(filter)}
              className={ledgerFilter === filter ? 'ui-chip-toggle ui-chip-toggle--active' : 'ui-chip-toggle ui-chip-toggle--inactive'}
            >
              {label}
            </button>
          ))}
          <div className="min-w-[220px] flex-1">
            <AppSelect value={ledgerProjectId} onChange={(event) => setLedgerProjectId(event.target.value)}>
              <option value="">All projects</option>
              {(projectsQuery.data ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </AppSelect>
          </div>
        </div>
        <TransactionLedgerTable
          entries={filteredEntries}
          onSettle={(entryId) => settleMutation.mutate(entryId)}
          onDelete={(entryId) => deleteMutation.mutate(entryId)}
          onEdit={(entryId, input) => editMutation.mutate({ entryId, input })}
          highlightOrderId={highlight}
          emptyMessage="No transactions match this filter yet. Marketplace orders and manual transfers will show here."
        />
      </AppCard>

      {draftOpen ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-ink/35 px-4 py-10 backdrop-blur-sm">
          <AppCard className="w-full max-w-lg space-y-4">
            <SectionHeading
              eyebrow="New transaction"
              title={draftKind === 'transfer' ? 'Move money' : draftKind === 'request' ? 'Request money' : 'Log manual item'}
              action={
                <button type="button" className="ui-soft-icon-button" onClick={resetDraft}>
                  <X className="h-4 w-4" />
                </button>
              }
            />
            <div className="flex flex-wrap gap-2">
              {(['transfer', 'request', 'manual'] as DraftKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setDraftKind(kind)}
                  className={draftKind === kind ? 'ui-chip-toggle ui-chip-toggle--active' : 'ui-chip-toggle ui-chip-toggle--inactive'}
                >
                  {kind === 'transfer' ? 'Transfer' : kind === 'request' ? 'Request' : 'Manual'}
                </button>
              ))}
            </div>
            <AppInput value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" />
            <div className="space-y-2">
              <AppInput
                value={counterpartyQuery}
                onChange={(event) => {
                  setCounterpartyQuery(event.target.value)
                  setSelectedPerson(null)
                }}
                placeholder="Pay @name or type a merchant"
              />
              {counterpartyQuery ? (
                <div className="grid gap-2 rounded-panel bg-cloud/70 p-2">
                  {filteredPeople.slice(0, 5).map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      className="ui-panel ui-panel--surface flex items-center justify-between gap-3 px-3 py-2 text-left transition hover:-translate-y-0.5"
                      onClick={() => {
                        setSelectedPerson({ id: person.id, label: person.display_name || person.handle, handle: person.handle })
                        setCounterpartyQuery(`@${person.handle}`)
                      }}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-ink">{person.display_name || person.handle}</p>
                        <p className="truncate text-xs text-ink/55">@{person.handle}</p>
                      </div>
                      <AppPill tone="teal">Use</AppPill>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <AppInput value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason or memo" />
            <div className="grid gap-3 sm:grid-cols-2">
              <AppSelect value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">No linked project</option>
                {(projectsQuery.data ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </AppSelect>
              <AppInput type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <AppButton variant="ghost" onClick={resetDraft}>
                Cancel
              </AppButton>
              <AppButton
                disabled={!session || !amount || !reason.trim() || !counterpartyQuery.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Saving...' : 'Save transaction'}
              </AppButton>
            </div>
          </AppCard>
        </div>
      ) : null}
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  tone: 'default' | 'butter' | 'peach' | 'teal' | 'surface'
}) {
  return (
    <AppPanel tone={tone} className="ui-summary-card">
      <div className="ui-summary-icon">{icon}</div>
      <p className="ui-summary-label">{label}</p>
      <p className="ui-summary-value">{value}</p>
    </AppPanel>
  )
}

type WalletEntry = Awaited<ReturnType<typeof fetchWalletEntries>>[number]

function TransactionLedgerTable({
  entries,
  onSettle,
  onDelete,
  onEdit,
  highlightOrderId,
  emptyMessage,
}: {
  entries: WalletEntry[]
  onSettle?: (entryId: string) => void
  onDelete?: (entryId: string) => void
  onEdit?: (entryId: string, input: { description?: string; amountCents?: number }) => void
  highlightOrderId?: string
  emptyMessage: string
}) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const [editAmount, setEditAmount] = useState('')

  function beginEdit(entry: WalletEntry) {
    setEditingEntryId(entry.id)
    setEditDesc(entry.description)
    setEditAmount(String(entry.totalCents / 100))
  }

  function commitEdit(entryId: string) {
    if (!onEdit) return
    onEdit(entryId, {
      description: editDesc.trim() || undefined,
      amountCents: editAmount ? Math.round(Number(editAmount) * 100) : undefined,
    })
    setEditingEntryId(null)
  }
  return (
    <div className="ui-ledger-shell">
      <table className="ui-ledger-table min-w-[1180px]">
        <thead className="ui-ledger-head">
          <tr>
            <th className="ui-ledger-head-cell">Date</th>
            <th className="ui-ledger-head-cell">Description</th>
            <th className="ui-ledger-head-cell">Counterparty</th>
            <th className="ui-ledger-head-cell">Tags</th>
            <th className="ui-ledger-head-cell">Product / item</th>
            <th className="ui-ledger-head-cell">Linked work</th>
            <th className="ui-ledger-head-cell text-right">Subtotal</th>
            <th className="ui-ledger-head-cell text-right">Tax</th>
            <th className="ui-ledger-head-cell text-right">Fee</th>
            <th className="ui-ledger-head-cell text-right">Total</th>
            <th className="ui-ledger-head-cell text-right">Net</th>
            <th className="ui-ledger-head-cell">Status</th>
            <th className="ui-ledger-head-cell">Reference</th>
            <th className="ui-ledger-head-cell">Action</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isHighlighted = highlightOrderId && (entry.orderId === highlightOrderId || entry.id === highlightOrderId)
            return (
            <tr key={entry.id} className={`ui-ledger-row${isHighlighted ? ' ring-2 ring-teal bg-teal/5' : ''}`}>
              <td className="ui-ledger-cell text-ink/65">
                <p>{new Date(entry.occurredAt).toLocaleDateString('en-AU')}</p>
                <p className="ui-ledger-meta">
                  {new Date(entry.occurredAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </td>
              <td className="ui-ledger-cell">
                {editingEntryId === entry.id ? (
                  <input
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(entry.id); if (e.key === 'Escape') setEditingEntryId(null) }}
                    className="w-full bg-transparent font-bold text-ink outline-none border-b border-ink/40 focus:border-ink"
                    autoFocus
                  />
                ) : (
                  <p className="font-bold text-ink">{entry.description}</p>
                )}
                <p className="ui-ledger-meta">{entry.direction === 'in' ? 'Incoming' : 'Outgoing'} movement</p>
              </td>
              <td className="ui-ledger-cell">
                {entry.counterpartyProfileId ? (
                  <Link to="/app/messages/profile/$profileId" params={{ profileId: entry.counterpartyProfileId }} className="font-bold text-ink">
                    {entry.counterpartyLabel}
                  </Link>
                ) : (
                  <p className="font-bold text-ink">{entry.counterpartyLabel}</p>
                )}
                {entry.counterpartyHandle ? <p className="ui-ledger-meta">{entry.counterpartyHandle}</p> : null}
              </td>
              <td className="ui-ledger-cell">
                <div className="flex flex-wrap gap-2">
                  <AppPill tone={entry.transactionRole === 'seller' ? 'peach' : entry.sourceKind === 'marketplace' ? 'teal' : 'butter'}>
                    {entry.transactionType}
                  </AppPill>
                  <AppPill>{entry.sourceKind}</AppPill>
                  {entry.project ? <AppPill tone="peach">{entry.project.id.slice(0, 8)}</AppPill> : null}
                </div>
                <p className="ui-ledger-meta mt-2 capitalize">{entry.transactionRole}</p>
              </td>
              <td className="ui-ledger-cell">
                {entry.listing ? (
                  <>
                    <p className="font-bold text-ink">{entry.listing.title}</p>
                    <p className="ui-ledger-meta">{entry.listing.kind}</p>
                  </>
                ) : (
                  <span className="text-ink/45">-</span>
                )}
              </td>
              <td className="ui-ledger-cell">
                {entry.project ? (
                  <Link to="/app/projects/$projectId/conversation" params={{ projectId: entry.project.id }} className="font-bold text-ink">
                    {entry.project.title}
                  </Link>
                ) : (
                  <span className="text-ink/45">-</span>
                )}
              </td>
              <td className="ui-ledger-cell--numeric">{formatCurrency(entry.subtotalCents, entry.currencyCode)}</td>
              <td className="ui-ledger-cell--numeric">{formatCurrency(entry.taxCents, entry.currencyCode)}</td>
              <td className="ui-ledger-cell--numeric">{formatCurrency(entry.platformFeeCents, entry.currencyCode)}</td>
              <td className={`ui-ledger-cell--numeric font-bold ${entry.direction === 'in' ? 'text-teal' : 'text-berry'}`}>
                {entry.direction === 'in' ? '+' : '-'}{formatCurrency(entry.totalCents, entry.currencyCode)}
              </td>
              <td className="ui-ledger-cell--numeric">{formatCurrency(entry.sellerNetCents, entry.currencyCode)}</td>
              <td className="ui-ledger-cell">
                <div className="flex flex-wrap gap-2">
                  <AppPill tone={entry.status === 'paid' || entry.status === 'settled' ? 'teal' : 'butter'}>{entry.status}</AppPill>
                  {entry.payoutStatus !== 'not_applicable' ? <AppPill tone={entry.payoutStatus === 'paid' ? 'teal' : 'peach'}>{entry.payoutStatus}</AppPill> : null}
                </div>
              </td>
              <td className="ui-ledger-cell text-ink/65">{entry.referenceNumber ?? entry.orderId ?? '-'}</td>
              <td className="ui-ledger-cell">
                <div className="flex flex-col gap-1">
                  {onSettle && entry.status === 'pending' ? (
                    <AppButton variant="ghost" className="px-3 py-2 text-xs" onClick={() => onSettle(entry.id)}>
                      Mark settled
                    </AppButton>
                  ) : null}
                  {onEdit && entry.transactionRole === 'manual' ? (
                    editingEntryId === entry.id ? (
                      <div className="space-y-1">
                        <input
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(entry.id); if (e.key === 'Escape') setEditingEntryId(null) }}
                          className="w-full bg-transparent text-xs font-bold text-ink outline-none border-b border-ink/40 focus:border-ink"
                          placeholder="Amount"
                        />
                        <div className="flex gap-1">
                          <AppButton variant="secondary" className="px-2 py-1 text-xs" onClick={() => commitEdit(entry.id)}>Save</AppButton>
                          <AppButton variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditingEntryId(null)}>Cancel</AppButton>
                        </div>
                      </div>
                    ) : (
                      <AppButton variant="ghost" className="px-3 py-2 text-xs" onClick={() => beginEdit(entry)}>
                        Edit
                      </AppButton>
                    )
                  ) : null}
                  {onDelete && entry.transactionRole === 'manual' ? (
                    deleteConfirmId === entry.id ? (
                      <div className="flex gap-1">
                        <AppButton variant="secondary" className="px-2 py-1 text-xs" onClick={() => { onDelete(entry.id); setDeleteConfirmId(null) }}>
                          Yes
                        </AppButton>
                        <AppButton variant="ghost" className="px-2 py-1 text-xs" onClick={() => setDeleteConfirmId(null)}>
                          No
                        </AppButton>
                      </div>
                    ) : (
                      <AppButton variant="ghost" className="px-3 py-2 text-xs" onClick={() => setDeleteConfirmId(entry.id)}>
                        Delete
                      </AppButton>
                    )
                  ) : null}
                  {!onSettle && !(onEdit && entry.transactionRole === 'manual') && !(onDelete && entry.transactionRole === 'manual') ? <span className="text-ink/45">-</span> : null}
                </div>
              </td>
            </tr>
            )
          })}
          {!entries.length ? (
            <tr>
              <td colSpan={14} className="ui-ledger-cell py-6 text-sm text-ink/60">
                {emptyMessage}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

export const walletRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'wallet',
  component: WalletPage,
  validateSearch: (search: Record<string, unknown>) => ({
    highlight: typeof search.highlight === 'string' ? search.highlight : undefined,
  }),
})
