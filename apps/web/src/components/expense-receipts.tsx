import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppButton } from '@superapp/ui'
import { database, featureError, uploadReceipt } from '@/lib/supplier-requests'
export function ExpenseReceipts({
  expenseId,
  ownerId,
}: {
  expenseId: string
  ownerId: string
}) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<{ id: string; href: string } | null>(null)
  const client = useQueryClient()
  const queryKey = ['expense-receipts', ownerId, expenseId]
  const receipts = useQuery({
    queryKey,
    enabled: open,
    queryFn: async () => {
      const { data, error } = await database()
        .from('expense_receipts')
        .select('*')
        .eq('expense_id', expenseId)
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
      if (input.file) await uploadReceipt(input.file, expenseId, ownerId)
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
    <div className="mt-3 border-t border-border pt-3">
      <AppButton variant="ghost" onClick={() => setOpen(!open)}>
        {open ? 'Hide receipts' : 'Receipts'}
      </AppButton>
      {open ? (
        <div className="space-y-2 text-sm">
          <p>
            Private attachments · images or PDF, up to 10 MB. Uploading does not
            change the cost or mark it paid.
          </p>
          <label className="block">
            Attach receipt
            <input
              className="block max-w-full"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={action.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) action.mutate({ file })
                e.target.value = ''
              }}
            />
          </label>
          {receipts.isPending ? <p>Loading receipts…</p> : null}
          {receipts.data?.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2">
              <span>{r.file_name}</span>
              <AppButton
                variant="ghost"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({ id: r.id, path: r.storage_path })
                }
              >
                Prepare private link
              </AppButton>
              {url && url.id === r.id ? (
                <a
                  href={url.href}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Open receipt (link lasts 1 minute)
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
      ) : null}
    </div>
  )
}
