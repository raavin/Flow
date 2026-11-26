import { useState } from 'react'
import { createRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AppCard,
  AppButton,
  AppInput,
  AppSelect,
  FieldLabel,
  SectionHeading,
} from '@superapp/ui'
import { appRoute } from '@/components/layout'
import { useAppStore } from '@/hooks/useAppStore'
import { fetchProjects } from '@/lib/projects'
import { parseBudgetAmount } from '@/lib/budget'
import { formatCurrency } from '@/lib/commerce'
import {
  database,
  featureError,
  rpc,
  fetchRequests,
  fetchQuotes,
  fetchAllocations,
  type SupplierRequest,
  type SupplierQuote,
} from '@/lib/supplier-requests'
const textArea =
  'min-h-24 w-full rounded-xl border border-border bg-surface p-3 text-ink'
function Brief({
  request: r,
}: {
  request: Pick<
    SupplierRequest,
    | 'title'
    | 'description'
    | 'context_note'
    | 'location_label'
    | 'due_on'
    | 'budget_cents'
  >
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold">{r.title}</h2>
      <p className="whitespace-pre-wrap">{r.description}</p>
      <p>
        {r.location_label || 'Location to discuss'} ·{' '}
        {r.due_on || 'Timing flexible'} ·{' '}
        {r.budget_cents === null
          ? 'Budget open to quotes'
          : `${formatCurrency(r.budget_cents)} AUD budget`}
      </p>
      {r.context_note ? (
        <div className="ui-panel">
          <p className="font-bold">Shared project context</p>
          <p className="whitespace-pre-wrap">{r.context_note}</p>
        </div>
      ) : null}
    </div>
  )
}
export function RequestsPage() {
  const { session } = useAppStore()
  const client = useQueryClient()
  const { projectId } = requestsRoute.useSearch()
  const requests = useQuery({
    queryKey: ['supplier-requests', session?.user.id],
    queryFn: fetchRequests,
  })
  const quotes = useQuery({
    queryKey: ['supplier-quotes', session?.user.id],
    queryFn: () => fetchQuotes(),
  })
  const projects = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const [tab, setTab] = useState('open')
  const [create, setCreate] = useState(!!projectId)
  const [preview, setPreview] = useState(false)
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    context: '',
    location: '',
    due: '',
    budget: '',
    project: projectId ?? '',
    allocation: '',
  })
  const allocations = useQuery({
    queryKey: ['allocations', session?.user.id, draft.project],
    queryFn: () => fetchAllocations(draft.project),
    enabled: !!draft.project,
  })
  const publish = useMutation({
    mutationFn: () =>
      rpc('publish_supplier_request', {
        p_title: draft.title,
        p_description: draft.description,
        p_context: draft.context,
        p_location: draft.location,
        p_due: draft.due || null,
        p_budget: draft.budget.trim() ? parseBudgetAmount(draft.budget) : null,
        p_project: draft.project || null,
        p_allocation: draft.allocation || null,
      }),
    onSuccess: () => {
      setCreate(false)
      setPreview(false)
      setDraft({
        title: '',
        description: '',
        context: '',
        location: '',
        due: '',
        budget: '',
        project: '',
        allocation: '',
      })
      setTab('mine')
      void client.invalidateQueries({ queryKey: ['supplier-requests'] })
    },
  })
  const [validation, setValidation] = useState('')
  const ownQuotes = new Set(
    (quotes.data ?? [])
      .filter((q) => q.supplier_id === session?.user.id)
      .map((q) => q.request_id),
  )
  const rows = (requests.data ?? []).filter((r) =>
    tab === 'mine'
      ? r.owner_id === session?.user.id
      : tab === 'quotes'
        ? ownQuotes.has(r.id)
        : r.status === 'open',
  )
  return (
    <div className="space-y-4">
      <AppCard className="space-y-3">
        <SectionHeading
          eyebrow="Marketplace · Requests & quotes"
          title="Find help to make it happen"
          action={
            <Link to="/app/marketplace" className="underline">
              Browse marketplace
            </Link>
          }
        />
        <p>
          Publish a focused brief, compare private quotes, and record the chosen
          cost in your plan. Agree on delivery and payment directly with your
          supplier.
        </p>
        <AppButton onClick={() => setCreate(!create)}>
          {create ? 'Close request form' : 'Request a quote'}
        </AppButton>
      </AppCard>
      {create ? (
        <AppCard className="space-y-3">
          {preview ? (
            <>
              <p className="font-bold">
                Review exactly what suppliers will see
              </p>
              <Brief
                request={{
                  title: draft.title,
                  description: draft.description,
                  context_note: draft.context,
                  location_label: draft.location,
                  due_on: draft.due || null,
                  budget_cents: draft.budget
                    ? parseBudgetAmount(draft.budget)
                    : null,
                }}
              />
              <p className="text-sm">
                Visible to signed-in marketplace members. Your project,
                conversations, budget records and receipts remain private. A
                request cannot be edited after publication; cancel it and
                publish a replacement if the brief changes.
              </p>
              <div className="flex gap-2">
                <AppButton
                  disabled={publish.isPending}
                  onClick={() => publish.mutate()}
                >
                  Publish request
                </AppButton>
                <AppButton
                  variant="ghost"
                  disabled={publish.isPending}
                  onClick={() => setPreview(false)}
                >
                  Edit brief
                </AppButton>
              </div>
            </>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                try {
                  if (draft.budget) parseBudgetAmount(draft.budget)
                  setValidation('')
                  setPreview(true)
                } catch (err) {
                  setValidation(featureError(err))
                }
              }}
            >
              <FieldLabel>
                What do you need?
                <AppInput
                  required
                  maxLength={160}
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  placeholder="Catering for a birthday, logo for a new business…"
                />
              </FieldLabel>
              <FieldLabel>
                Requirements and what the quote should include
                <textarea
                  className={textArea}
                  required
                  maxLength={6000}
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </FieldLabel>
              <FieldLabel>
                Project context to share (optional)
                <textarea
                  className={textArea}
                  maxLength={4000}
                  value={draft.context}
                  onChange={(e) =>
                    setDraft({ ...draft, context: e.target.value })
                  }
                  placeholder="Only include details you want suppliers to see. Avoid addresses or private information."
                />
              </FieldLabel>
              <div className="grid gap-3 sm:grid-cols-3">
                <FieldLabel>
                  Broad location / remote
                  <AppInput
                    maxLength={160}
                    value={draft.location}
                    onChange={(e) =>
                      setDraft({ ...draft, location: e.target.value })
                    }
                  />
                </FieldLabel>
                <FieldLabel>
                  Needed by (optional)
                  <AppInput
                    type="date"
                    value={draft.due}
                    onChange={(e) =>
                      setDraft({ ...draft, due: e.target.value })
                    }
                  />
                </FieldLabel>
                <FieldLabel>
                  Budget ceiling (AUD, optional)
                  <AppInput
                    inputMode="decimal"
                    value={draft.budget}
                    onChange={(e) =>
                      setDraft({ ...draft, budget: e.target.value })
                    }
                  />
                </FieldLabel>
              </div>
              <FieldLabel>
                Link your project (private)
                <AppSelect
                  value={draft.project}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      project: e.target.value,
                      allocation: '',
                    })
                  }
                >
                  <option value="">No project</option>
                  {projects.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </AppSelect>
              </FieldLabel>
              {draft.project ? (
                <FieldLabel>
                  Budget allocation (private)
                  <AppSelect
                    value={draft.allocation}
                    onChange={(e) =>
                      setDraft({ ...draft, allocation: e.target.value })
                    }
                  >
                    <option value="">Unallocated</option>
                    {allocations.data?.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </AppSelect>
                </FieldLabel>
              ) : null}
              <AppButton type="submit">Preview supplier brief</AppButton>
            </form>
          )}
          {validation || publish.error || allocations.error ? (
            <p role="alert">
              {validation || featureError(publish.error || allocations.error)}
            </p>
          ) : null}
        </AppCard>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {[
          ['open', 'Open requests'],
          ['mine', 'My requests'],
          ['quotes', 'My quotes'],
        ].map(([id, label]) => (
          <AppButton
            key={id}
            variant={tab === id ? 'primary' : 'ghost'}
            onClick={() => setTab(id)}
          >
            {label}
          </AppButton>
        ))}
      </div>
      {requests.isPending ? <p>Loading requests…</p> : null}
      {requests.error || quotes.error ? (
        <p role="alert">{featureError(requests.error || quotes.error)}</p>
      ) : null}
      {!requests.isPending && !requests.error && !rows.length ? (
        <AppCard>
          No requests here yet. Start with something your plan needs.
        </AppCard>
      ) : null}
      {rows.map((r) => (
        <AppCard key={r.id}>
          <Link
            to="/app/marketplace/requests/$requestId"
            params={{ requestId: r.id }}
            className="text-lg font-bold underline"
          >
            {r.title}
          </Link>
          <p>
            {r.status} · {r.location_label || 'Location flexible'} ·{' '}
            {r.budget_cents === null
              ? 'Open to quotes'
              : formatCurrency(r.budget_cents)}
          </p>
          <p className="line-clamp-2">{r.description}</p>
        </AppCard>
      ))}
    </div>
  )
}
function QuoteDiscussion({ quote, me }: { quote: SupplierQuote; me: string }) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const client = useQueryClient()
  const key = ['quote-messages', me, quote.id]
  const messages = useQuery({
    queryKey: key,
    enabled: open,
    queryFn: async () => {
      const { data, error } = await database()
        .from('quote_messages')
        .select('*')
        .eq('quote_id', quote.id)
        .order('created_at')
      if (error) throw error
      return data
    },
    refetchInterval: open ? 30000 : false,
  })
  const send = useMutation({
    mutationFn: async () => {
      const { error } = await database()
        .from('quote_messages')
        .insert({ quote_id: quote.id, sender_id: me, body: body.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      setBody('')
      void client.invalidateQueries({ queryKey: key })
    },
  })
  return (
    <div className="mt-3">
      <AppButton variant="ghost" onClick={() => setOpen(!open)}>
        {open ? 'Hide discussion' : 'Discuss this quote privately'}
      </AppButton>
      {open ? (
        <div className="space-y-2">
          <p className="text-xs">
            Only the requester and this supplier can read these messages.
          </p>
          {messages.data?.map((m) => (
            <p key={m.id} className="ui-panel whitespace-pre-wrap">
              <strong>
                {m.sender_id === me
                  ? 'You'
                  : m.sender_id === quote.supplier_id
                    ? quote.supplier_label
                    : 'Requester'}
                :{' '}
              </strong>
              {m.body}
            </p>
          ))}
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              send.mutate()
            }}
          >
            <textarea
              aria-label="Private quote message"
              className={textArea}
              required
              maxLength={3000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <AppButton disabled={!body.trim() || send.isPending}>
              Send message
            </AppButton>
          </form>
          {messages.error || send.error ? (
            <p role="alert">{featureError(messages.error || send.error)}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
function QuoteEditor({
  requestId,
  quote,
  onSaved,
}: {
  requestId: string
  quote?: SupplierQuote
  onSaved: () => void
}) {
  const [amount, setAmount] = useState(
    quote ? String(quote.amount_cents / 100) : '',
  )
  const [details, setDetails] = useState(quote?.details ?? '')
  const [available, setAvailable] = useState(quote?.available_on ?? '')
  const [valid, setValid] = useState(quote?.valid_until ?? '')
  const save = useMutation({
    mutationFn: () =>
      rpc('submit_supplier_quote', {
        p_request: requestId,
        p_amount: parseBudgetAmount(amount),
        p_details: details,
        p_available: available || null,
        p_valid: valid || null,
      }),
    onSuccess: onSaved,
  })
  return (
    <AppCard>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <SectionHeading
          eyebrow="Your private quote"
          title={quote ? 'Revise your quote' : 'Offer to help'}
        />
        <FieldLabel>
          Total price including fees (AUD)
          <AppInput
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </FieldLabel>
        <FieldLabel>
          Inclusions, exclusions and delivery terms
          <textarea
            className={textArea}
            required
            maxLength={6000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </FieldLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldLabel>
            Available from
            <AppInput
              type="date"
              value={available}
              onChange={(e) => setAvailable(e.target.value)}
            />
          </FieldLabel>
          <FieldLabel>
            Quote valid through (optional)
            <AppInput
              type="date"
              value={valid}
              onChange={(e) => setValid(e.target.value)}
            />
          </FieldLabel>
        </div>
        <p className="text-sm">
          Only you and the requester can see your quote. You can revise or
          withdraw it until a supplier is selected. Selection does not collect
          money.
        </p>
        <AppButton disabled={save.isPending}>
          {quote ? 'Save revised quote' : 'Submit quote'}
        </AppButton>
        {save.error ? <p role="alert">{featureError(save.error)}</p> : null}
      </form>
    </AppCard>
  )
}
export function RequestDetail() {
  const { requestId } = requestDetailRoute.useParams()
  const { session } = useAppStore()
  const client = useQueryClient()
  const [confirm, setConfirm] = useState<string | null>(null)
  const request = useQuery({
    queryKey: ['supplier-request', session?.user.id, requestId],
    queryFn: async () => {
      const { data, error } = await database()
        .from('marketplace_requests')
        .select('*')
        .eq('id', requestId)
        .single()
      if (error) throw error
      return data as SupplierRequest
    },
  })
  const quotes = useQuery({
    queryKey: ['supplier-quotes', session?.user.id, requestId],
    queryFn: () => fetchQuotes(requestId),
  })
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['supplier-request'] })
    void client.invalidateQueries({ queryKey: ['supplier-requests'] })
    void client.invalidateQueries({ queryKey: ['supplier-quotes'] })
    void client.invalidateQueries({ queryKey: ['expenses'] })
    setConfirm(null)
  }
  const action = useMutation({
    mutationFn: ({
      name,
      args,
    }: {
      name: string
      args: Record<string, unknown>
    }) => rpc(name, args),
    onSuccess: refresh,
  })
  const r = request.data
  const owner = r?.owner_id === session?.user.id
  const own = quotes.data?.find((q) => q.supplier_id === session?.user.id)
  if (request.isPending) return <p>Loading request…</p>
  if (!r) return <p role="alert">{featureError(request.error)}</p>
  return (
    <div className="space-y-4">
      <Link to="/app/marketplace/requests" search={{}} className="underline">
        Back to requests
      </Link>
      <AppCard className="space-y-3">
        <p className="text-sm uppercase">{r.status}</p>
        <Brief request={r} />
        {owner && r.project_id ? (
          <Link
            to="/app/projects/$projectId/budget"
            params={{ projectId: r.project_id }}
            className="inline-block underline"
          >
            Open project budget
          </Link>
        ) : null}
        {owner && (r.status === 'open' || r.status === 'assigned') ? (
          <AppButton
            variant="ghost"
            disabled={action.isPending}
            onClick={() => {
              if (
                window.confirm(
                  r.status === 'open'
                    ? 'Cancel this request and decline pending quotes?'
                    : 'Mark the work complete? This will not mark its cost paid.',
                )
              )
                action.mutate({
                  name: 'close_supplier_request',
                  args: {
                    p_request: r.id,
                    p_status: r.status === 'open' ? 'cancelled' : 'completed',
                  },
                })
            }}
          >
            {r.status === 'open' ? 'Cancel request' : 'Mark work complete'}
          </AppButton>
        ) : null}
      </AppCard>
      <h2 className="text-xl font-bold">
        {owner ? 'Compare quotes' : 'Your quote'}
      </h2>
      {quotes.isPending ? <p>Loading quotes…</p> : null}
      {!quotes.isPending && !quotes.error && !quotes.data?.length ? (
        <p>No quotes yet.</p>
      ) : null}
      {quotes.data?.map((q) => (
        <AppCard key={q.id} className="space-y-2">
          <div className="flex flex-wrap justify-between gap-2">
            <h3 className="font-bold">{q.supplier_label}</h3>
            <strong>
              {formatCurrency(q.amount_cents)} AUD · {q.status}
            </strong>
          </div>
          <p className="whitespace-pre-wrap">{q.details}</p>
          <p>
            Available: {q.available_on || 'To agree'} · Valid through:{' '}
            {q.valid_until || 'Until withdrawn or request closes'}
          </p>
          {r.budget_cents !== null && q.amount_cents > r.budget_cents ? (
            <p className="font-bold">
              {formatCurrency(q.amount_cents - r.budget_cents)} above the
              request budget
            </p>
          ) : null}
          {owner && r.status === 'open' && q.status === 'pending' ? (
            confirm === q.id ? (
              <div className="ui-panel space-y-2">
                <p>
                  Choose this supplier for {formatCurrency(q.amount_cents)}?{' '}
                  {r.project_id
                    ? 'This adds a committed cost to your project budget.'
                    : 'This request has no project, so no budget cost will be created.'}{' '}
                  Other pending quotes will be declined. No money is
                  transferred.
                </p>
                <AppButton
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate({
                      name: 'choose_supplier_quote',
                      args: { p_quote: q.id },
                    })
                  }
                >
                  Confirm supplier
                </AppButton>
                <AppButton
                  variant="ghost"
                  disabled={action.isPending}
                  onClick={() => setConfirm(null)}
                >
                  Keep comparing
                </AppButton>
              </div>
            ) : (
              <AppButton
                disabled={action.isPending}
                onClick={() => setConfirm(q.id)}
              >
                Choose this quote
              </AppButton>
            )
          ) : null}
          {!owner && r.status === 'open' && q.status === 'pending' ? (
            <AppButton
              variant="ghost"
              disabled={action.isPending}
              onClick={() => {
                if (window.confirm('Withdraw your quote?'))
                  action.mutate({
                    name: 'withdraw_supplier_quote',
                    args: { p_quote: q.id },
                  })
              }}
            >
              Withdraw quote
            </AppButton>
          ) : null}
          {session ? <QuoteDiscussion quote={q} me={session.user.id} /> : null}
        </AppCard>
      ))}
      {session &&
      !owner &&
      r.status === 'open' &&
      !quotes.isPending &&
      !quotes.error &&
      (!own || ['pending', 'withdrawn'].includes(own.status)) ? (
        <QuoteEditor
          key={own ? `${own.id}-${own.status}` : 'new'}
          requestId={r.id}
          quote={own}
          onSaved={refresh}
        />
      ) : null}
      {quotes.error || action.error ? (
        <p role="alert">{featureError(quotes.error || action.error)}</p>
      ) : null}
    </div>
  )
}
export const requestsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/requests',
  validateSearch: (
    search: Record<string, unknown>,
  ): { projectId?: string } => ({
    projectId:
      typeof search.projectId === 'string' ? search.projectId : undefined,
  }),
  component: RequestsPage,
})
export const requestDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'marketplace/requests/$requestId',
  component: RequestDetail,
})
