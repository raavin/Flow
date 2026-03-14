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
      (array_agg(linked_project_id) filter (where linked_project_id is not null))[1] as linked_project_id,
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
        and marketplace_listings.owner_id is not distinct from seller_group.seller_id
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
