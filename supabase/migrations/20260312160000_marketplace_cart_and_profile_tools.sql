create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.marketplace_listings (id) on delete cascade,
  linked_project_id uuid references public.projects (id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  booking_note text,
  booking_date timestamptz,
  split_with text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.cart_items enable row level security;

create policy "cart_items_read_own" on public.cart_items
  for select using (auth.uid() = owner_id);

create policy "cart_items_write_own" on public.cart_items
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
