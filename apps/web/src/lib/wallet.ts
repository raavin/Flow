import type { FinancialTransaction, SalesLedgerRow } from '@superapp/types'
import { supabase } from './supabase'
import { createNotification } from './coordination'

type TransactionRow = {
  id: string
  profile_id: string
  counterparty_profile_id: string | null
  order_id: string | null
  linked_project_id: string | null
  linked_listing_id: string | null
  transaction_role: FinancialTransaction['transactionRole']
  transaction_type: FinancialTransaction['transactionType']
  source_kind: FinancialTransaction['sourceKind']
  direction: FinancialTransaction['direction']
  description: string
  counterparty_label: string
  counterparty_handle: string | null
  reference_number: string | null
  currency_code: string
  subtotal_cents: number
  tax_cents: number
  platform_fee_cents: number
  total_cents: number
  seller_net_cents: number
  status: FinancialTransaction['status']
  payout_status: FinancialTransaction['payoutStatus']
  occurred_at: string
  created_at: string
  projects: { id: string; title: string } | { id: string; title: string }[] | null
  marketplace_listings:
    | { id: string; title: string; kind: string; price_label: string }
    | { id: string; title: string; kind: string; price_label: string }[]
    | null
}

type OrderRow = {
  id: string
  order_number: string
  buyer_profile_id: string
  created_at: string
  payment_status: 'pending' | 'paid' | 'refunded'
  payout_status: 'not_applicable' | 'pending' | 'paid'
  currency_code: string
}

type OrderItemRow = {
  id: string
  order_id: string
  listing_id: string | null
  linked_project_id: string | null
  workspace_project_id: string | null
  title_snapshot: string
  sku_snapshot: string | null
  subtotal_cents: number
  tax_cents: number
  platform_fee_cents: number
  total_cents: number
  seller_net_cents: number
}

export async function fetchWalletEntries() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('financial_transactions')
    .select(
      'id, profile_id, counterparty_profile_id, order_id, linked_project_id, linked_listing_id, transaction_role, transaction_type, source_kind, direction, description, counterparty_label, counterparty_handle, reference_number, currency_code, subtotal_cents, tax_cents, platform_fee_cents, total_cents, seller_net_cents, status, payout_status, occurred_at, created_at, projects(id, title), marketplace_listings(id, title, kind, price_label)',
    )
    .order('occurred_at', { ascending: false })
  if (error) throw error

  return ((data as TransactionRow[]) ?? []).map((entry) => ({
    id: entry.id,
    profileId: entry.profile_id,
    counterpartyProfileId: entry.counterparty_profile_id,
    orderId: entry.order_id,
    linkedProjectId: entry.linked_project_id,
    linkedListingId: entry.linked_listing_id,
    transactionRole: entry.transaction_role,
    transactionType: entry.transaction_type,
    sourceKind: entry.source_kind,
    direction: entry.direction,
    description: entry.description,
    counterpartyLabel: entry.counterparty_label,
    counterpartyHandle: entry.counterparty_handle,
    referenceNumber: entry.reference_number,
    currencyCode: entry.currency_code,
    subtotalCents: entry.subtotal_cents,
    taxCents: entry.tax_cents,
    platformFeeCents: entry.platform_fee_cents,
    totalCents: entry.total_cents,
    sellerNetCents: entry.seller_net_cents,
    status: entry.status,
    payoutStatus: entry.payout_status,
    occurredAt: entry.occurred_at,
    createdAt: entry.created_at,
    project: Array.isArray(entry.projects) ? entry.projects[0] ?? null : entry.projects,
    listing: Array.isArray(entry.marketplace_listings) ? entry.marketplace_listings[0] ?? null : entry.marketplace_listings,
  }))
}

export async function fetchSellerLedgerRows() {
  if (!supabase) return []
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: orders, error: ordersError } = await supabase
    .from('commerce_orders')
    .select('id, order_number, buyer_profile_id, created_at, payment_status, payout_status, currency_code')
    .eq('seller_profile_id', user.id)
    .order('created_at', { ascending: false })
  if (ordersError) throw ordersError
  if (!orders?.length) return []

  const orderIds = orders.map((order) => order.id)
  const buyerIds = [...new Set(orders.map((order) => order.buyer_profile_id))]

  const [
    { data: items, error: itemsError },
    { data: transactions, error: transactionsError },
    { data: profiles, error: profilesError },
    { data: socialProfiles, error: socialProfilesError },
    { error: projectsError },
  ] = await Promise.all([
    supabase
      .from('commerce_order_items')
      .select(
        'id, order_id, listing_id, linked_project_id, workspace_project_id, title_snapshot, sku_snapshot, subtotal_cents, tax_cents, platform_fee_cents, total_cents, seller_net_cents',
      )
      .in('order_id', orderIds),
    supabase
      .from('financial_transactions')
      .select('id, order_id')
      .eq('transaction_role', 'seller')
      .eq('source_kind', 'marketplace')
      .in('order_id', orderIds),
    supabase.from('profiles').select('id, first_name, last_name').in('id', buyerIds),
    supabase.from('social_profiles').select('id, handle, display_name').in('id', buyerIds),
    Promise.resolve({ data: [], error: null }),
  ])
  if (itemsError) throw itemsError
  if (transactionsError) throw transactionsError
  if (profilesError) throw profilesError
  if (socialProfilesError) throw socialProfilesError
  if (projectsError) throw projectsError

  const relevantProjectIds = [
    ...new Set(
      ((items as OrderItemRow[]) ?? []).flatMap((item) =>
        [item.linked_project_id, item.workspace_project_id].filter(Boolean) as string[],
      ),
    ),
  ]

  const { data: projects, error: loadedProjectsError } = relevantProjectIds.length
    ? await supabase.from('projects').select('id, title').in('id', relevantProjectIds)
    : { data: [], error: null }
  if (loadedProjectsError) throw loadedProjectsError

  const orderMap = new Map((orders as OrderRow[]).map((order) => [order.id, order]))
  const transactionMap = new Map(((transactions as Array<{ id: string; order_id: string }>) ?? []).map((row) => [row.order_id, row.id]))
  const profileMap = new Map(
    ((profiles as Array<{ id: string; first_name: string; last_name: string | null }>) ?? []).map((profile) => [
      profile.id,
      profile,
    ]),
  )
  const socialMap = new Map(
    ((socialProfiles as Array<{ id: string; handle: string; display_name: string }>) ?? []).map((profile) => [
      profile.id,
      profile,
    ]),
  )
  const projectMap = new Map((((projects as Array<{ id: string; title: string }>) ?? [])).map((project) => [project.id, project.title]))

  return ((items as OrderItemRow[]) ?? []).map((item) => {
    const order = orderMap.get(item.order_id)!
    const profile = profileMap.get(order.buyer_profile_id)
    const social = socialMap.get(order.buyer_profile_id)
    const customerDisplayName =
      social?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || social?.handle || 'Customer'

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      transactionId: transactionMap.get(order.id) ?? null,
      orderItemId: item.id,
      orderDate: order.created_at,
      customerProfileId: order.buyer_profile_id,
      customerDisplayName,
      customerHandle: social?.handle ? `@${social.handle}` : null,
      productTitle: item.title_snapshot,
      listingId: item.listing_id,
      listingCode: item.sku_snapshot,
      linkedProjectId: item.linked_project_id,
      linkedProjectTitle: item.linked_project_id ? projectMap.get(item.linked_project_id) ?? null : null,
      workspaceProjectId: item.workspace_project_id,
      workspaceProjectTitle: item.workspace_project_id ? projectMap.get(item.workspace_project_id) ?? null : null,
      subtotalCents: item.subtotal_cents,
      taxCents: item.tax_cents,
      platformFeeCents: item.platform_fee_cents,
      totalCents: item.total_cents,
      sellerNetCents: item.seller_net_cents,
      paymentStatus: order.payment_status,
      payoutStatus: order.payout_status,
      currencyCode: order.currency_code,
    } satisfies SalesLedgerRow
  })
}

export async function createWalletEntry(input: {
  profileId: string
  linkedProjectId?: string | null
  linkedListingId?: string | null
  relatedProfileId?: string | null
  entryKind: 'send' | 'request' | 'iou'
  transactionType?: 'transfer' | 'purchase' | 'sale' | 'request' | 'refund' | 'payout'
  sourceKind?: 'manual' | 'marketplace' | 'peer' | 'project'
  direction: 'in' | 'out'
  amountCents: number
  counterparty: string
  reason: string
  note?: string
  dueOn?: string
  occurredAt?: string
}) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const transactionType =
    input.transactionType ?? (input.entryKind === 'request' ? 'request' : input.sourceKind === 'marketplace' ? 'purchase' : 'transfer')
  const sourceKind = input.sourceKind ?? (input.linkedListingId ? 'marketplace' : input.relatedProfileId ? 'peer' : input.linkedProjectId ? 'project' : 'manual')
  const status = input.entryKind === 'request' ? 'pending' : 'settled'

  const { error } = await supabase.from('financial_transactions').insert({
    profile_id: input.profileId,
    counterparty_profile_id: input.relatedProfileId ?? null,
    linked_project_id: input.linkedProjectId ?? null,
    linked_listing_id: input.linkedListingId ?? null,
    transaction_role: 'manual',
    transaction_type: transactionType,
    source_kind: sourceKind,
    direction: input.direction,
    description: input.reason,
    counterparty_label: input.counterparty,
    reference_number: null,
    currency_code: 'AUD',
    subtotal_cents: input.amountCents,
    tax_cents: 0,
    platform_fee_cents: 0,
    total_cents: input.amountCents,
    seller_net_cents: input.amountCents,
    status,
    payout_status: 'not_applicable',
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    metadata: {
      note: input.note ?? null,
      dueOn: input.dueOn ?? null,
      legacyEntryKind: input.entryKind,
    },
  })
  if (error) throw error

  await createNotification({
    profileId: input.profileId,
    title: sourceKind === 'marketplace' ? 'Purchase recorded' : 'Transaction recorded',
    body: `${input.counterparty} · $${(input.amountCents / 100).toFixed(2)}`,
    kind: 'payments',
    linkUrl: '/app/wallet',
  })
}

export async function settleWalletEntry(entryId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('financial_transactions').update({ status: 'settled' }).eq('id', entryId)
  if (error) throw error
}
