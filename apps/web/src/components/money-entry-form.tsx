import { supabase } from '@/lib/supabase'
import { ReceiptPicker } from './receipt-picker'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AppButton, AppInput, AppSelect, FieldLabel } from '@superapp/ui'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchProjects } from '@/lib/projects'
import { createExpense, updateExpense } from '@/lib/planning'
import { createWalletEntry, updateWalletEntry } from '@/lib/wallet'
import { parseBudgetAmount } from '@/lib/budget'
import {
  fetchAllocations,
  uploadReceipt,
  validateReceipt,
  featureError,
  type ReceiptTarget,
} from '@/lib/supplier-requests'
import { localDay, type MoneyRecord } from '@/lib/money'

export function MoneyEntryForm({
  projectId: initialProject = '',
  expenseId,
  record,
  defaultDirection = 'out',
  defaultTitle = '',
  defaultCounterparty = '',
  defaultAllocationId = '',
  onSaved,
  onCancel,
}: {
  projectId?: string
  expenseId?: string
  record?: MoneyRecord
  defaultDirection?: 'in' | 'out'
  defaultTitle?: string
  defaultCounterparty?: string
  defaultAllocationId?: string
  onSaved: (target: ReceiptTarget) => void
  onCancel?: () => void
}) {
  const { session } = useAppStore()
  const client = useQueryClient()
  const projects = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const [projectId, setProject] = useState(record?.projectId ?? initialProject)
  const [direction, setDirection] = useState(record?.direction ?? defaultDirection)
  const [title, setTitle] = useState(record?.title ?? defaultTitle)
  const [counterparty, setCounterparty] = useState(record?.counterparty ?? defaultCounterparty)
  const [date, setDate] = useState(record?.date || localDay())
  const [estimate, setEstimate] = useState(
    record?.estimate === undefined ? '' : String(record.estimate / 100),
  )
  const [amount, setAmount] = useState(
    record
      ? record.target.kind === 'expense' && record.status !== 'paid' && !record.actual
        ? ''
        : String((record.actual ?? record.amount) / 100)
      : '',
  )
  const [category, setCategory] = useState(record?.category ?? 'General')
  const [allocation, setAllocation] = useState(record?.allocationId ?? defaultAllocationId)
  const [status, setStatus] = useState(
    (expenseId ? 'paid' : record?.hasPayments ? 'committed' : record?.status) ??
      (defaultDirection === 'in' ? 'pending' : initialProject ? 'planned' : 'paid'),
  )
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<ReceiptTarget | null>(null)
  // Editing an existing record preserves its storage model; new project spending is one budget cost.
  const isCost = record ? record.target.kind === 'expense' : !expenseId && !!projectId && direction === 'out'
  const allocations = useQuery({
    queryKey: ['allocations', session?.user.id, projectId],
    queryFn: () => fetchAllocations(projectId),
    enabled: !!projectId && isCost,
  })
  const refresh = () => {
    for (const key of ['expenses', 'wallet', 'projects', 'project-detail', 'expense-receipts'])
      void client.invalidateQueries({ queryKey: [key] })
  }
  async function submit() {
    if (!session || busy) return
    setBusy(true)
    setError('')
    let target = saved
    try {
      if (file) validateReceipt(file)
      if (!target) {
        if (!title.trim()) throw new Error('Enter a description.')
        if (status === 'paid' && !amount.trim())
          throw new Error('Enter the actual amount paid, including zero if there was no cost.')
        if (isCost) {
          const input = {
            title: title.trim(),
            category: category.trim() || 'General',
            estimateCents: parseBudgetAmount(estimate),
            actualCents: parseBudgetAmount(amount),
            paymentStatus:
              status === 'paid'
                ? ('paid' as const)
                : status === 'planned'
                  ? ('unpaid' as const)
                  : ('pending' as const),
            allocationId: allocation || null,
            incurredOn: date,
            counterparty: counterparty.trim(),
          }
          if (record) {
            await updateExpense(record.target.id, input)
            target = record.target
          } else {
            const id = await createExpense({
              ...input,
              ownerId: session.user.id,
              projectId,
            })
            target = { kind: 'expense', id }
          }
        } else {
          const amountCents = parseBudgetAmount(amount)
          if (!amountCents) throw new Error('Enter an amount greater than zero.')
          if (record) {
            await updateWalletEntry(record.target.id, {
              description: title.trim(),
              amountCents,
              direction,
              status: status === 'paid' ? 'settled' : 'pending',
              counterparty: counterparty.trim(),
              occurredAt: new Date(`${date}T12:00:00`).toISOString(),
            })
            target = record.target
          } else {
            const id = await createWalletEntry({
              profileId: session.user.id,
              linkedProjectId: projectId || null,
              entryKind: status === 'paid' ? 'send' : direction === 'in' ? 'request' : 'iou',
              direction,
              amountCents,
              counterparty: counterparty.trim(),
              reason: title.trim(),
              occurredAt: new Date(`${date}T12:00:00`).toISOString(),
            })
            target = { kind: 'transaction', id }
          }
        }
        setSaved(target)
        refresh()
      }
      if (expenseId && target?.kind === 'transaction') {
        const { error: linkError } = await supabase!.rpc('link_payment_to_cost', {
          p_transaction: target.id,
          p_expense: expenseId,
        })
        if (linkError) throw linkError
      }
      if (file) await uploadReceipt(file, target, session.user.id)
      refresh()
      onSaved(target)
    } catch (e) {
      setError(
        `${target ? (expenseId ? 'Record saved. An attachment or cost link could not be saved. ' : 'Record saved. Receipt upload failed. ') : ''}${featureError(e)}`,
      )
    } finally {
      setBusy(false)
    }
  }
  function chooseFile(next: File | undefined) {
    if (!next) return
    try {
      validateReceipt(next)
      setFile(next)
      setError('')
    } catch (e) {
      setError(featureError(e))
    }
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <fieldset disabled={busy || !!saved} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FieldLabel>
          Type
          <AppSelect
            value={direction}
            disabled={!!record || !!expenseId}
            onChange={(e) => {
              setDirection(e.target.value as 'in' | 'out')
              setStatus('paid')
            }}
          >
            <option value="out">Expense</option>
            <option value="in">Income</option>
          </AppSelect>
        </FieldLabel>
        <FieldLabel>
          Project
          <AppSelect
            value={projectId}
            disabled={!!record || !!initialProject}
            onChange={(e) => {
              setProject(e.target.value)
              setAllocation('')
              setStatus('paid')
            }}
          >
            <option value="">No project</option>
            {projects.data
              ?.filter((p) => p.isOwner !== false)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
          </AppSelect>
        </FieldLabel>
        <FieldLabel>
          {record?.hasPayments ? 'Status (from linked payments)' : 'Status'}
          <AppSelect
            value={status}
            disabled={record?.hasPayments}
            onChange={(e) => setStatus(e.target.value)}
          >
            {isCost ? (
              <>
                <option value="planned">Planned</option>
                <option value="committed">Committed / unpaid</option>
              </>
            ) : (
              <option value="pending">{direction === 'in' ? 'Expected' : 'Unpaid'}</option>
            )}
            <option value="paid">{direction === 'in' ? 'Received' : 'Paid'}</option>
          </AppSelect>
        </FieldLabel>
        <FieldLabel>
          {isCost ? 'Cost name' : 'Description'}
          <AppInput autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} />
        </FieldLabel>
        <FieldLabel>
          Person or business
          <AppInput maxLength={200} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
        </FieldLabel>
        <FieldLabel>
          Date
          <AppInput required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FieldLabel>
        {isCost ? (
          <>
            <FieldLabel>
              Category
              <AppInput value={category} onChange={(e) => setCategory(e.target.value)} />
            </FieldLabel>
            <FieldLabel>
              Budget allocation
              <AppSelect value={allocation} onChange={(e) => setAllocation(e.target.value)}>
                <option value="">Unallocated</option>
                {allocations.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </AppSelect>
            </FieldLabel>
            <FieldLabel>
              Estimate (AUD)
              <AppInput inputMode="decimal" value={estimate} onChange={(e) => setEstimate(e.target.value)} />
            </FieldLabel>
          </>
        ) : null}
        <FieldLabel>
          {isCost ? 'Actual cost (AUD)' : `Amount (${record?.currency ?? 'AUD'})`}
          <AppInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </FieldLabel>
      </fieldset>
      {allocations.error || projects.error ? (
        <p role="alert">Could not load project options. Please reload before saving.</p>
      ) : null}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Receipt (optional)</p>
        <div className="flex flex-wrap items-center gap-2">
          <ReceiptPicker disabled={busy} onChoose={chooseFile} />
          {file ? (
            <>
              <span className="min-w-0 break-all text-sm">{file.name}</span>
              <AppButton type="button" variant="ghost" disabled={busy} onClick={() => setFile(null)}>
                Remove file
              </AppButton>
            </>
          ) : (
            <span className="text-xs text-ink/65">Private · up to 10 MB</span>
          )}
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-berry">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <AppButton disabled={busy || !session || !!allocations.error || !!projects.error}>
          {busy ? 'Saving…' : saved ? 'Retry receipt upload' : record ? 'Save changes' : 'Save entry'}
        </AppButton>
        {saved ? (
          <AppButton type="button" variant="secondary" disabled={busy} onClick={() => onSaved(saved)}>
            Finish without receipt
          </AppButton>
        ) : onCancel ? (
          <AppButton type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </AppButton>
        ) : null}
        <span className="text-xs text-ink/65">
          {isCost ? 'Updates this project’s budget.' : 'No money is transferred.'}
        </span>
      </div>
    </form>
  )
}
