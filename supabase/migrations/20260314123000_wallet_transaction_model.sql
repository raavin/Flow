alter table public.wallet_entries
  add column if not exists transaction_type text not null default 'transfer'
    check (transaction_type in ('transfer', 'purchase', 'sale', 'request', 'refund', 'payout')),
  add column if not exists source_kind text not null default 'manual'
    check (source_kind in ('manual', 'marketplace', 'peer', 'project')),
  add column if not exists linked_listing_id uuid references public.marketplace_listings (id) on delete set null,
  add column if not exists related_profile_id uuid references public.profiles (id) on delete set null,
  add column if not exists occurred_at timestamptz not null default timezone('utc', now());

update public.wallet_entries
set transaction_type = case
  when entry_kind = 'request' then 'request'
  else 'transfer'
end
where transaction_type is null;
