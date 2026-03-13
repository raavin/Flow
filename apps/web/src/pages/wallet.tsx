import { useState } from 'react'
import { createRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppCard, AppInput, AppPanel, AppSelect, SectionHeading } from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchProjects } from '@/lib/projects'
import { createWalletEntry, fetchWalletEntries, settleWalletEntry } from '@/lib/wallet'

function WalletPage() {
  const { session } = useAppStore()
  const queryClient = useQueryClient()
  const entriesQuery = useQuery({ queryKey: ['wallet'], queryFn: fetchWalletEntries })
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const [entryKind, setEntryKind] = useState<'send' | 'request' | 'iou'>('iou')
  const [direction, setDirection] = useState<'in' | 'out'>('out')
  const [amount, setAmount] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [reason, setReason] = useState('')
  const [projectId, setProjectId] = useState('')
  const mutation = useMutation({
    mutationFn: () =>
      createWalletEntry({
        profileId: session!.user.id,
        linkedProjectId: projectId || null,
        entryKind,
        direction,
        amountCents: Math.round(Number(amount || 0) * 100),
        counterparty,
        reason,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
    },
  })
  const settleMutation = useMutation({
    mutationFn: (entryId: string) => settleWalletEntry(entryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wallet'] })
    },
  })

  const entries = entriesQuery.data ?? []
  const outstanding = entries.filter((entry) => entry.status === 'pending')
  const settled = entries.filter((entry) => entry.status === 'settled')

  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <AppCard className="space-y-4">
        <SectionHeading eyebrow="Wallet" title="Track money movement" />
        <AppSelect value={entryKind} onChange={(event) => setEntryKind(event.target.value as typeof entryKind)}>
          <option value="send">Send money</option>
          <option value="request">Request money</option>
          <option value="iou">Create IOU</option>
        </AppSelect>
        <AppSelect value={direction} onChange={(event) => setDirection(event.target.value as typeof direction)}>
          <option value="out">I owe / paying out</option>
          <option value="in">Owed to me / incoming</option>
        </AppSelect>
        <AppInput value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" />
        <AppInput value={counterparty} onChange={(event) => setCounterparty(event.target.value)} placeholder="Counterparty" />
        <AppInput value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" />
        <AppSelect value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">No linked project</option>
          {(projectsQuery.data ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </AppSelect>
        <AppButton disabled={!session || mutation.isPending} onClick={() => mutation.mutate()}>
          Save wallet item
        </AppButton>
      </AppCard>

      <div className="space-y-4">
        <AppCard className="space-y-4">
          <SectionHeading eyebrow="Outstanding" title="Pending money" />
          <div className="grid gap-3">
            {outstanding.map((entry) => (
              <AppPanel key={entry.id}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-ink">{entry.counterparty}</p>
                    <p className="text-sm text-ink/65">
                      {entry.entry_kind} · {entry.reason} · ${(entry.amount_cents / 100).toFixed(2)}
                    </p>
                  </div>
                  <AppButton variant="secondary" onClick={() => settleMutation.mutate(entry.id)}>
                    Settle
                  </AppButton>
                </div>
              </AppPanel>
            ))}
            {!outstanding.length ? <p className="text-sm text-ink/60">No outstanding entries right now.</p> : null}
          </div>
        </AppCard>

        <AppCard className="space-y-4">
          <SectionHeading eyebrow="Settled" title="Done and dusted" />
          <div className="grid gap-3">
            {settled.map((entry) => (
              <AppPanel key={entry.id} className="text-sm">
                {entry.counterparty} · {entry.reason} · ${(entry.amount_cents / 100).toFixed(2)}
              </AppPanel>
            ))}
            {!settled.length ? <p className="text-sm text-ink/60">Settled items will show up here.</p> : null}
          </div>
        </AppCard>
      </div>
    </div>
  )
}

export const walletRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'wallet',
  component: WalletPage,
})
