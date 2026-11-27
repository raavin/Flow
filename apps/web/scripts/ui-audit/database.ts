// Synthetic data only. This module never calls Supabase and rejects all writes.
const project = {
  id: 'sample-party',
  owner_id: 'audit-owner',
  title: 'Birthday dinner',
  category: 'Personal',
  status: 'active',
  project_kind: 'general',
  target_date: '2026-12-12',
  budget_cents: 50000,
}
const rows: Record<string, Record<string, unknown>[]> = {
  money_budget_settings: [{ owner_id: 'audit-owner', budget_cents: 200000 }],
  budget_funds: [{ id: 'sample-personal', name: 'Personal', budget_cents: 80000 }],
  project_budget_limits: [
    { project_id: 'sample-party', budget_cents: 50000, fund_id: 'sample-personal' },
    { project_id: 'sample-launch', budget_cents: 100000 },
    { project_id: 'sample-completed', budget_cents: 0 },
  ],
  projects: [
    project,
    {
      ...project,
      id: 'sample-launch',
      title: 'Business launch',
      category: 'Work',
      budget_cents: 100000,
    },
    {
      ...project,
      id: 'sample-gifts',
      title: 'Birthday presents',
      budget_cents: null,
    },
    {
      ...project,
      id: 'sample-completed',
      title: 'Weekend trip',
      status: 'completed',
      budget_cents: 0,
    },
  ],
  marketplace_listings: [
    {
      id: 'sample-listing',
      owner_id: 'sample-seller',
      title: 'Dinner checklist',
      summary: 'A checklist for a dinner with friends.',
      kind: 'template',
      category: 'Events',
      price_cents: 0,
      price_label: 'Free',
      currency_code: 'AUD',
      is_published: true,
      created_at: '2026-11-26T00:00:00Z',
      template_payload: null,
    },
  ],
  business_profiles: [
    {
      id: 'sample-seller',
      business_name: 'Sample plans',
      category: 'Events',
      service_area: 'Melbourne',
      offerings: ['Dinner planning'],
    },
  ],
  social_profiles: [
    {
      id: 'audit-owner',
      handle: 'preview',
      display_name: 'Preview user',
      bio: 'Sample account for interface review.',
    },
  ],
  posts: [
    {
      id: 'sample-post',
      author_id: 'audit-owner',
      body: 'Planning a birthday dinner. What should we cook?',
      content_kind: 'discussion',
      visibility: 'public',
      created_at: '2026-11-26T00:00:00Z',
      updated_at: '2026-11-26T00:00:00Z',
      metadata: {},
      reply_to_post_id: null,
      quote_post_id: null,
      linked_project_id: null,
      is_promoted: false,
      mislabel_flag_count: 0,
      review_state: 'clear',
    },
  ],
  jobs: [
    {
      id: 'sample-job',
      owner_id: 'audit-owner',
      title: 'Catering setup',
      customer_name: 'Sam',
      linked_project_id: 'sample-party',
      status: 'upcoming',
      payment_state: 'unpaid',
      booking_at: '2026-12-12T07:00:00Z',
      notes: 'Confirm guest numbers.',
      created_at: '2026-11-26T00:00:00Z',
    },
  ],
  project_participants: [
    {
      id: 'sample-person',
      project_id: 'sample-party',
      owner_id: 'audit-owner',
      name: 'Sam',
      participant_kind: 'person',
      role: 'helper',
      status: 'active',
      contact_hint: '@sam',
      availability_status: 'available Saturday morning',
    },
  ],
  dm_threads: [
    {
      id: 'sample-chat',
      owner_id: 'audit-owner',
      title: 'Dinner planning',
      thread_kind: 'direct',
      linked_project_id: 'sample-party',
      created_at: '2026-11-26T00:00:00Z',
    },
  ],
  dm_messages: [
    {
      id: 'sample-message',
      thread_id: 'sample-chat',
      author_id: 'audit-owner',
      body: 'Let’s confirm the menu.',
      metadata: {},
      created_at: '2026-11-26T00:00:00Z',
    },
  ],
  marketplace_requests: [
    {
      id: 'sample-request',
      owner_id: 'audit-owner',
      project_id: 'sample-party',
      title: 'Catering for 12',
      description: 'Vegan dinner for twelve people.',
      context_note: 'Kitchen available.',
      location_label: 'Melbourne',
      status: 'open',
      budget_cents: 30000,
      created_at: '2026-11-26T00:00:00Z',
    },
  ],

  project_expenses: [
    {
      id: 'sample-cost',
      owner_id: 'audit-owner',
      project_id: project.id,
      title: 'Groceries',
      category: 'Food',
      allocation_id: 'sample-food',
      estimate_cents: 15000,
      actual_cents: 13850,
      payment_status: 'paid',
      incurred_on: '2026-11-26',
      counterparty_label: 'Local grocer',
      linked_listing_id: null,
    },
    {
      id: 'sample-cake',
      owner_id: 'audit-owner',
      project_id: project.id,
      title: 'Birthday cake',
      category: 'Food',
      allocation_id: 'sample-food',
      estimate_cents: 9000,
      actual_cents: 0,
      payment_status: 'unpaid',
      incurred_on: '2026-12-10',
      linked_listing_id: null,
    },
    {
      id: 'sample-venue',
      owner_id: 'audit-owner',
      project_id: project.id,
      title: 'Venue hire',
      category: 'Venue',
      allocation_id: 'sample-venue-allocation',
      estimate_cents: 20000,
      actual_cents: 22000,
      payment_status: 'pending',
      incurred_on: '2026-12-08',
      counterparty_label: 'Town hall',
      linked_listing_id: null,
    },
    {
      id: 'sample-business-cost',
      owner_id: 'audit-owner',
      project_id: 'sample-launch',
      title: 'Equipment',
      category: 'Equipment',
      allocation_id: null,
      estimate_cents: 120000,
      actual_cents: 0,
      payment_status: 'unpaid',
      incurred_on: '2026-12-10',
      linked_listing_id: null,
    },
  ],
  project_budget_allocations: [
    {
      id: 'sample-food',
      owner_id: 'audit-owner',
      project_id: project.id,
      name: 'Food',
      limit_cents: 20000,
    },
    {
      id: 'sample-venue-allocation',
      owner_id: 'audit-owner',
      project_id: project.id,
      name: 'Venue',
      limit_cents: 25000,
    },
  ],
  financial_transactions: [
    {
      id: 'sample-payment',
      profile_id: 'audit-owner',
      transaction_role: 'manual',
      transaction_type: 'payment',
      source_kind: 'project',
      linked_project_id: project.id,
      direction: 'in',
      description: 'Guest contributions',
      counterparty_label: 'Sam',
      currency_code: 'AUD',
      subtotal_cents: 13850,
      tax_cents: 0,
      platform_fee_cents: 0,
      total_cents: 13850,
      seller_net_cents: 13850,
      status: 'settled',
      payout_status: 'not_applicable',
      occurred_at: '2026-11-26T09:00:00Z',
      created_at: '2026-11-26T09:00:00Z',
      projects: project,
    },
  ],
  coordination_objects: [
    {
      id: 'sample-plan',
      owner_id: 'audit-owner',
      kind: 'plan',
      display_kind: 'plan',
      title: 'Birthday dinner',
      summary: 'Plan the menu, invite friends and buy groceries.',
      intent: 'celebrate',
      state: 'scheduled',
      starts_at: '2026-11-26T00:00:00Z',
      ends_at: '2026-12-12T23:59:00Z',
      due_at: null,
      is_all_day: true,
      flexibility: 'shiftable',
      parent_id: null,
      linked_project_id: project.id,
      metadata: {},
      coordination_object_participants: [],
      created_at: '2026-11-26T00:00:00Z',
      updated_at: '2026-11-26T00:00:00Z',
    },
  ],
}
function query(table: string) {
  let single = false
  let data = rows[table] ?? []
  const result = new Proxy(
    {},
    {
      get: (_, key) =>
        key === 'then'
          ? (resolve: (value: unknown) => void) =>
              resolve({
                data: single ? (data[0] ?? null) : data,
                error: null,
                count: data.length,
              })
          : (...args: unknown[]) => {
              if (['insert', 'update', 'delete', 'upsert'].includes(String(key)))
                throw new Error('Visual preview: saving is disabled.')
              if (['single', 'maybeSingle'].includes(String(key))) single = true
              if (key === 'eq') data = data.filter((row) => row[String(args[0])] === args[1])
              if (key === 'in')
                data = data.filter((row) => (args[1] as unknown[]).includes(row[String(args[0])]))
              return result
            },
    },
  )
  return result
}
const channel = { on: () => channel, subscribe: () => channel }
export const supabase = {
  from: query,
  rpc: async (name: string, args?: Record<string, unknown>) => {
    if (name === 'feed_post_ids') {
      const posts = rows.posts.filter(
        (post) =>
          (!args?.p_post || post.id === args.p_post) &&
          (!args?.p_project || post.linked_project_id === args.p_project) &&
          (!args?.p_author || post.author_id === args.p_author),
      )
      return { data: posts.map((post) => ({ id: post.id, sort_at: post.created_at })), error: null }
    }
    if (name === 'dm_inbox')
      return {
        data: rows.dm_threads.map((thread) => ({
          ...thread,
          last_body: 'Let’s confirm the menu.',
          last_at: thread.created_at,
          unread: 0,
        })),
        error: null,
      }
    if (name === 'project_invitations') return { data: [], error: null }
    if (name === 'mark_dm_read') return { data: null, error: null }
    if (name === 'search_flow')
      return {
        data: { people: [], topics: [], projects: [], listings: [], jobs: [], messages: [] },
        error: null,
      }
    if (!/^(get|fetch|search|browse)_/.test(name)) throw new Error('Visual preview: saving is disabled.')
    return { data: [], error: null }
  },
  channel: () => channel,
  removeChannel: async () => {},
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'audit-owner' } } } }),
    getUser: async () => ({ data: { user: { id: 'audit-owner' } } }),
  },
  storage: {
    from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }),
  },
}
