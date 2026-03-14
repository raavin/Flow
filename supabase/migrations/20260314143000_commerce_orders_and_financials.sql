alter table public.projects
  add column if not exists project_kind text not null default 'general'
    check (project_kind in ('general', 'product_workspace', 'service_workspace', 'template_workspace'));

alter table public.marketplace_listings
  add column if not exists workspace_project_id uuid references public.projects (id) on delete set null,
  add column if not exists price_cents integer not null default 0 check (price_cents >= 0),
  add column if not exists currency_code text not null default 'AUD',
  add column if not exists sku text,
  add column if not exists tax_rate_basis_points integer not null default 1000 check (tax_rate_basis_points >= 0),
  add column if not exists fulfillment_notes text not null default '',
  add column if not exists commerce_metadata jsonb not null default '{}'::jsonb;

update public.marketplace_listings
set price_cents = coalesce(
  nullif(price_cents, 0),
  coalesce(
    ((regexp_match(price_label, '([0-9]+(?:\.[0-9]+)?)'))[1])::numeric,
    0
  ) * 100
)::integer;

create sequence if not exists public.commerce_order_number_seq start with 1000;

create or replace function public.next_order_number()
returns text
language sql
as $$
  select 'ORD-' || lpad(nextval('public.commerce_order_number_seq')::text, 6, '0');
$$;

create or replace function public.profile_display_label(target_profile_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(trim(bp.business_name), ''),
    nullif(trim(sp.display_name), ''),
    nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
    case when sp.handle is not null then '@' || sp.handle end,
    'Flow member'
  )
  from public.profiles p
  left join public.business_profiles bp on bp.id = p.id
  left join public.social_profiles sp on sp.id = p.id
  where p.id = target_profile_id
$$;

create or replace function public.profile_handle(target_profile_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select case when sp.handle is not null then '@' || sp.handle else null end
  from public.social_profiles sp
  where sp.id = target_profile_id
$$;

create table if not exists public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default public.next_order_number(),
  buyer_profile_id uuid not null references public.profiles (id) on delete cascade,
  seller_profile_id uuid references public.profiles (id) on delete set null,
  linked_project_id uuid references public.projects (id) on delete set null,
  currency_code text not null default 'AUD',
  status text not null default 'placed'
    check (status in ('placed', 'paid', 'fulfilled', 'cancelled', 'refunded')),
  payment_status text not null default 'paid'
    check (payment_status in ('pending', 'paid', 'refunded')),
  payout_status text not null default 'pending'
    check (payout_status in ('not_applicable', 'pending', 'paid')),
  booking_note text,
  booking_date timestamptz,
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  seller_net_cents integer not null default 0,
  payment_provider text not null default 'mock',
  payment_reference text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.commerce_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders (id) on delete cascade,
  listing_id uuid references public.marketplace_listings (id) on delete set null,
  seller_profile_id uuid references public.profiles (id) on delete set null,
  linked_project_id uuid references public.projects (id) on delete set null,
  workspace_project_id uuid references public.projects (id) on delete set null,
  title_snapshot text not null,
  kind_snapshot text not null check (kind_snapshot in ('template', 'service', 'product')),
  category_snapshot text not null default '',
  sku_snapshot text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  seller_net_cents integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  counterparty_profile_id uuid references public.profiles (id) on delete set null,
  order_id uuid references public.commerce_orders (id) on delete set null,
  linked_project_id uuid references public.projects (id) on delete set null,
  linked_listing_id uuid references public.marketplace_listings (id) on delete set null,
  transaction_role text not null default 'manual'
    check (transaction_role in ('buyer', 'seller', 'manual')),
  transaction_type text not null default 'transfer'
    check (transaction_type in ('transfer', 'purchase', 'sale', 'request', 'refund', 'payout')),
  source_kind text not null default 'manual'
    check (source_kind in ('manual', 'marketplace', 'peer', 'project')),
  direction text not null check (direction in ('in', 'out')),
  description text not null default '',
  counterparty_label text not null default '',
  counterparty_handle text,
  reference_number text,
  currency_code text not null default 'AUD',
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  seller_net_cents integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'placed', 'paid', 'fulfilled', 'cancelled', 'refunded', 'settled')),
  payout_status text not null default 'not_applicable'
    check (payout_status in ('not_applicable', 'pending', 'paid')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.cart_items
  add column if not exists order_id uuid references public.commerce_orders (id) on delete set null,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.cart_items drop constraint if exists cart_items_status_check;
update public.cart_items
set status = 'ordered'
where status = 'confirmed';

alter table public.cart_items
  add constraint cart_items_status_check
    check (status in ('draft', 'ordered', 'removed'));

create index if not exists idx_commerce_orders_buyer_created_at on public.commerce_orders (buyer_profile_id, created_at desc);
create index if not exists idx_commerce_orders_seller_created_at on public.commerce_orders (seller_profile_id, created_at desc);
create index if not exists idx_financial_transactions_profile_occurred_at on public.financial_transactions (profile_id, occurred_at desc);
create index if not exists idx_cart_items_owner_status_created_at on public.cart_items (owner_id, status, created_at desc);

alter table public.commerce_orders enable row level security;
alter table public.commerce_order_items enable row level security;
alter table public.financial_transactions enable row level security;

create policy "commerce_orders_read_parties" on public.commerce_orders
  for select using (auth.uid() = buyer_profile_id or auth.uid() = seller_profile_id);

create policy "commerce_order_items_read_parties" on public.commerce_order_items
  for select using (
    exists (
      select 1
      from public.commerce_orders
      where commerce_orders.id = commerce_order_items.order_id
        and (commerce_orders.buyer_profile_id = auth.uid() or commerce_orders.seller_profile_id = auth.uid())
    )
  );

create policy "financial_transactions_read_own" on public.financial_transactions
  for select using (auth.uid() = profile_id);

create policy "financial_transactions_write_own" on public.financial_transactions
  for all using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists commerce_orders_updated_at on public.commerce_orders;
create trigger commerce_orders_updated_at
  before update on public.commerce_orders
  for each row execute function public.handle_updated_at();

drop trigger if exists cart_items_updated_at on public.cart_items;
create trigger cart_items_updated_at
  before update on public.cart_items
  for each row execute function public.handle_updated_at();

create or replace function public.place_order_from_cart(cart_item_ids uuid[] default null)
returns table (
  order_id uuid,
  order_number text,
  seller_profile_id uuid,
  total_cents integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  buyer_id uuid := auth.uid();
  seller_group record;
  item_row record;
  created_order_id uuid;
  created_order_number text;
  item_subtotal integer;
  item_tax integer;
  item_fee integer;
  item_total integer;
  item_seller_net integer;
begin
  if buyer_id is null then
    raise exception 'You must be signed in to check out.';
  end if;

  if not exists (
    select 1
    from public.cart_items
    where owner_id = buyer_id
      and status = 'draft'
      and (cart_item_ids is null or id = any(cart_item_ids))
  ) then
    raise exception 'Your cart is empty.';
  end if;

  for seller_group in
    with selected_cart as (
      select
        cart_items.id as cart_item_id,
        cart_items.linked_project_id,
        cart_items.booking_note,
        cart_items.booking_date,
        cart_items.quantity,
        marketplace_listings.id as listing_id,
        marketplace_listings.owner_id as seller_id,
        marketplace_listings.title,
        marketplace_listings.kind,
        marketplace_listings.category,
        marketplace_listings.sku,
        marketplace_listings.price_cents,
        marketplace_listings.currency_code,
        marketplace_listings.tax_rate_basis_points,
        marketplace_listings.workspace_project_id
      from public.cart_items
      join public.marketplace_listings on marketplace_listings.id = cart_items.listing_id
      where cart_items.owner_id = buyer_id
        and cart_items.status = 'draft'
        and (cart_item_ids is null or cart_items.id = any(cart_item_ids))
    )
    select
      seller_id,
      currency_code,
      min(linked_project_id) as linked_project_id,
      min(nullif(booking_note, '')) as booking_note,
      min(booking_date) as booking_date,
      sum(price_cents * quantity)::integer as subtotal_cents,
      sum(round(((price_cents * quantity)::numeric * tax_rate_basis_points::numeric) / 10000.0))::integer as tax_cents,
      sum(round(((price_cents * quantity)::numeric * 500.0) / 10000.0))::integer as platform_fee_cents,
      sum((price_cents * quantity) + round(((price_cents * quantity)::numeric * tax_rate_basis_points::numeric) / 10000.0))::integer as total_cents,
      sum(((price_cents * quantity) + round(((price_cents * quantity)::numeric * tax_rate_basis_points::numeric) / 10000.0)) - round(((price_cents * quantity)::numeric * 500.0) / 10000.0))::integer as seller_net_cents
    from selected_cart
    group by seller_id, currency_code
  loop
    insert into public.commerce_orders as inserted (
      order_number,
      buyer_profile_id,
      seller_profile_id,
      linked_project_id,
      currency_code,
      status,
      payment_status,
      payout_status,
      booking_note,
      booking_date,
      subtotal_cents,
      tax_cents,
      platform_fee_cents,
      total_cents,
      seller_net_cents,
      payment_provider
    )
    values (
      public.next_order_number(),
      buyer_id,
      seller_group.seller_id,
      seller_group.linked_project_id,
      seller_group.currency_code,
      'placed',
      'paid',
      'pending',
      seller_group.booking_note,
      seller_group.booking_date,
      seller_group.subtotal_cents,
      seller_group.tax_cents,
      seller_group.platform_fee_cents,
      seller_group.total_cents,
      seller_group.seller_net_cents,
      'mock'
    )
    returning inserted.id, inserted.order_number into created_order_id, created_order_number;

    for item_row in
      select
        cart_items.id as cart_item_id,
        cart_items.linked_project_id,
        cart_items.booking_note,
        cart_items.booking_date,
        cart_items.quantity,
        marketplace_listings.id as listing_id,
        marketplace_listings.owner_id as seller_id,
        marketplace_listings.title,
        marketplace_listings.kind,
        marketplace_listings.category,
        marketplace_listings.sku,
        marketplace_listings.price_cents,
        marketplace_listings.currency_code,
        marketplace_listings.tax_rate_basis_points,
        marketplace_listings.workspace_project_id
      from public.cart_items
      join public.marketplace_listings on marketplace_listings.id = cart_items.listing_id
      where cart_items.owner_id = buyer_id
        and cart_items.status = 'draft'
        and marketplace_listings.owner_id = seller_group.seller_id
        and marketplace_listings.currency_code = seller_group.currency_code
        and (cart_item_ids is null or cart_items.id = any(cart_item_ids))
    loop
      item_subtotal := item_row.price_cents * item_row.quantity;
      item_tax := round((item_subtotal::numeric * item_row.tax_rate_basis_points::numeric) / 10000.0);
      item_fee := round((item_subtotal::numeric * 500.0) / 10000.0);
      item_total := item_subtotal + item_tax;
      item_seller_net := item_total - item_fee;

      insert into public.commerce_order_items (
        order_id,
        listing_id,
        seller_profile_id,
        linked_project_id,
        workspace_project_id,
        title_snapshot,
        kind_snapshot,
        category_snapshot,
        sku_snapshot,
        quantity,
        unit_price_cents,
        subtotal_cents,
        tax_cents,
        platform_fee_cents,
        total_cents,
        seller_net_cents,
        metadata
      )
      values (
        created_order_id,
        item_row.listing_id,
        item_row.seller_id,
        item_row.linked_project_id,
        item_row.workspace_project_id,
        item_row.title,
        item_row.kind,
        item_row.category,
        item_row.sku,
        item_row.quantity,
        item_row.price_cents,
        item_subtotal,
        item_tax,
        item_fee,
        item_total,
        item_seller_net,
        jsonb_build_object(
          'bookingNote', item_row.booking_note,
          'bookingDate', item_row.booking_date
        )
      );

      if item_row.linked_project_id is not null then
        insert into public.project_expenses (
          owner_id,
          project_id,
          category,
          title,
          estimate_cents,
          actual_cents,
          payment_status,
          linked_listing_id
        )
        values (
          buyer_id,
          item_row.linked_project_id,
          'marketplace',
          item_row.title,
          item_total,
          item_total,
          'paid',
          item_row.listing_id
        );

        insert into public.project_activity (
          project_id,
          owner_id,
          activity_type,
          title,
          detail
        )
        values (
          item_row.linked_project_id,
          buyer_id,
          'marketplace_purchase',
          'Marketplace purchase placed',
          item_row.title || ' · ' || created_order_number
        );
      end if;

      update public.cart_items
      set status = 'ordered',
          order_id = created_order_id
      where id = item_row.cart_item_id;
    end loop;

    insert into public.financial_transactions (
      profile_id,
      counterparty_profile_id,
      order_id,
      linked_project_id,
      transaction_role,
      transaction_type,
      source_kind,
      direction,
      description,
      counterparty_label,
      counterparty_handle,
      reference_number,
      currency_code,
      subtotal_cents,
      tax_cents,
      platform_fee_cents,
      total_cents,
      seller_net_cents,
      status,
      payout_status,
      occurred_at,
      metadata
    )
    values (
      buyer_id,
      seller_group.seller_id,
      created_order_id,
      seller_group.linked_project_id,
      'buyer',
      'purchase',
      'marketplace',
      'out',
      'Marketplace order',
      coalesce(public.profile_display_label(seller_group.seller_id), 'Marketplace'),
      public.profile_handle(seller_group.seller_id),
      created_order_number,
      seller_group.currency_code,
      seller_group.subtotal_cents,
      seller_group.tax_cents,
      seller_group.platform_fee_cents,
      seller_group.total_cents,
      seller_group.seller_net_cents,
      'paid',
      'not_applicable',
      timezone('utc', now()),
      jsonb_build_object('orderNumber', created_order_number)
    );

    if seller_group.seller_id is not null then
      insert into public.financial_transactions (
        profile_id,
        counterparty_profile_id,
        order_id,
        linked_project_id,
        transaction_role,
        transaction_type,
        source_kind,
        direction,
        description,
        counterparty_label,
        counterparty_handle,
        reference_number,
        currency_code,
        subtotal_cents,
        tax_cents,
        platform_fee_cents,
        total_cents,
        seller_net_cents,
        status,
        payout_status,
        occurred_at,
        metadata
      )
      values (
        seller_group.seller_id,
        buyer_id,
        created_order_id,
        seller_group.linked_project_id,
        'seller',
        'sale',
        'marketplace',
        'in',
        'Marketplace sale',
        public.profile_display_label(buyer_id),
        public.profile_handle(buyer_id),
        created_order_number,
        seller_group.currency_code,
        seller_group.subtotal_cents,
        seller_group.tax_cents,
        seller_group.platform_fee_cents,
        seller_group.total_cents,
        seller_group.seller_net_cents,
        'paid',
        'pending',
        timezone('utc', now()),
        jsonb_build_object('orderNumber', created_order_number)
      );
    end if;

    order_id := created_order_id;
    order_number := created_order_number;
    seller_profile_id := seller_group.seller_id;
    total_cents := seller_group.total_cents;
    return next;
  end loop;
end;
$$;
