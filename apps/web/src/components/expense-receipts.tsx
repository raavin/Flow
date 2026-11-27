import { ReceiptPicker } from './receipt-picker'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppButton } from '@superapp/ui'
import {
  database,
  featureError,
  uploadReceipt,
  type ReceiptTarget,
} from '@/lib/supplier-requests'
export function ExpenseReceipts({
  expenseId,
  target,
  ownerId,
}: {
  expenseId?: string
  target?: ReceiptTarget
  ownerId: string
}) {
  const [url, setUrl] = useState<{ id: string; href: string } | null>(null)
  const client = useQueryClient()
  const parent = target ?? { kind: 'expense' as const, id: expenseId! }
  const queryKey = ['expense-receipts', ownerId, parent.kind, parent.id]
  const receipts = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await database()
        .from('expense_receipts')
        .select('*')
        .eq(
          parent.kind === 'expense' ? 'expense_id' : 'transaction_id',
          parent.id,
        )
        .order('created_at')
      if (error) throw error
      return data
    },
  })
  const action = useMutation({
    mutationFn: async (input: {
      file?: File
      id?: string
      path?: string
      remove?: boolean
    }) => {
      if (input.file) await uploadReceipt(input.file, parent, ownerId)
      else if (input.remove && input.path && input.id) {
        const { error } = await database()
          .storage.from('expense-receipts')
          .remove([input.path])
        if (error) throw error
        const { error: e } = await database()
          .from('expense_receipts')
          .delete()
          .eq('id', input.id)
        if (e) throw e
        setUrl(null)
      } else if (input.path && input.id) {
        const { data, error } = await database()
          .storage.from('expense-receipts')
          .createSignedUrl(input.path, 60)
        if (error) throw error
        setUrl({ id: input.id, href: data.signedUrl })
      }
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey })
    },
  })
  return (
    <div className="space-y-2 text-sm">
      <p>Add a photo or PDF, up to 10 MB. Receipts are private.</p>
      <ReceiptPicker
        disabled={action.isPending}
        onChoose={(file) => action.mutate({ file })}
      />
      {action.isPending ? <p role="status">Updating receipt…</p> : null}
      {receipts.isPending ? (
        <p>Loading receipts…</p>
      ) : receipts.data?.length === 0 ? (
        <p className="text-ink/65">No receipts attached.</p>
      ) : null}
      {receipts.data?.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-all">{r.file_name}</span>
          <AppButton
            variant="ghost"
            disabled={action.isPending}
            onClick={() => action.mutate({ id: r.id, path: r.storage_path })}
          >
            View receipt
          </AppButton>
          {url && url.id === r.id ? (
            <a
              href={url.href}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Open receipt
            </a>
          ) : null}
          <AppButton
            variant="ghost"
            disabled={action.isPending}
            onClick={() => {
              if (window.confirm('Remove this receipt?'))
                action.mutate({
                  id: r.id,
                  path: r.storage_path,
                  remove: true,
                })
            }}
          >
            Remove
          </AppButton>
        </div>
      ))}
      {receipts.error || action.error ? (
        <p role="alert">{featureError(receipts.error || action.error)}</p>
      ) : null}
    </div>
  )
}
