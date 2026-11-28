import { useId, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AppButton, AppInput } from '@superapp/ui'
import { parseBudgetAmount } from '@/lib/budget'
import { formatCurrency } from '@/lib/commerce'
import { featureError } from '@/lib/supplier-requests'
import type { BudgetNode } from '@/lib/budget-ledger'

// Inputs belong to a real form via the form attribute. A form must not wrap a <tr>.
export function BudgetLineRow({
  kind,
  row,
  onSave,
  onCancel,
  onRemove,
}: {
  kind: 'group' | 'allocation'
  row?: BudgetNode
  onSave: (name: string, amount: number | null) => Promise<void>
  onCancel: () => void
  onRemove?: () => void
}) {
  const formId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(row?.name ?? '')
  const [amount, setAmount] = useState(row?.budget == null ? '' : String(row.budget / 100))
  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error(`Enter the ${kind} name.`)
      if (kind === 'allocation' && !amount.trim())
        throw new Error('Enter a budget, including zero if needed.')
      await onSave(name.trim(), amount.trim() ? parseBudgetAmount(amount) : null)
    },
    onSuccess: () => {
      if (row) onCancel()
      else {
        setName('')
        setAmount('')
        requestAnimationFrame(() => nameRef.current?.focus())
      }
    },
  })
  const label = `${kind === 'group' ? 'Group' : 'Allocation'} name`
  return (
    <>
      <tr
        className="budget-draft"
        aria-label={row ? `Edit ${row.name}` : `New ${kind}`}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !save.isPending) onCancel()
        }}
      >
        <th scope="row" className="budget-name-cell">
          <AppInput
            ref={nameRef}
            autoFocus
            form={formId}
            aria-label={label}
            placeholder={kind === 'group' ? 'Group name' : 'e.g. Catering'}
            required
            maxLength={100}
            value={name}
            disabled={save.isPending}
            onChange={(e) => setName(e.target.value)}
          />
        </th>
        <td className="budget-money">
          <AppInput
            form={formId}
            aria-label="Budget (AUD)"
            inputMode="decimal"
            placeholder="0.00"
            required={kind === 'allocation'}
            value={amount}
            disabled={save.isPending}
            onChange={(e) => setAmount(e.target.value)}
            className="budget-cell-input"
          />
        </td>
        <td className="budget-money">{row ? formatCurrency(row.actual) : '—'}</td>
        <td className="budget-money">{row ? formatCurrency(row.expected) : '—'}</td>
        <td className="budget-money">
          {row?.budget == null ? '—' : formatCurrency(row.budget - row.expected)}
        </td>
        <td className="budget-actions">
          <form
            id={formId}
            onSubmit={(e) => {
              e.preventDefault()
              save.mutate()
            }}
            className="flex gap-1 justify-end"
          >
            <AppButton disabled={save.isPending}>{save.isPending ? 'Saving…' : `Save ${kind}`}</AppButton>
            <AppButton type="button" variant="ghost" disabled={save.isPending} onClick={onCancel}>
              Cancel
            </AppButton>
          </form>
        </td>
      </tr>
      <tr className="budget-draft">
        <td colSpan={6} className="!py-1">
          <div className="budget-inline-panel flex flex-wrap items-center gap-3 text-xs text-ink/65">
            {save.error ? (
              <p role="alert" className="text-berry">
                {featureError(save.error)}
              </p>
            ) : !row ? (
              <p>Save adds this line and opens the next.</p>
            ) : null}
            {onRemove && (
              <AppButton
                type="button"
                variant="ghost"
                disabled={save.isPending || (row?.kind === 'allocation' && row.children.length > 0)}
                title={
                  row?.kind === 'allocation' && row.children.length
                    ? 'Move the costs before removing this allocation.'
                    : undefined
                }
                onClick={onRemove}
              >
                Remove {kind}
              </AppButton>
            )}
          </div>
        </td>
      </tr>
    </>
  )
}
