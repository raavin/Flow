-- A payment can settle one planned cost. Several payments can settle that cost.
alter table public.financial_transactions add column expense_id uuid references public.project_expenses(id) on delete restrict;
create index financial_transactions_expense_idx on public.financial_transactions(expense_id);
create table public.payment_link_history(id uuid primary key default gen_random_uuid(),profile_id uuid not null references public.profiles(id),transaction_id uuid not null references public.financial_transactions(id) on delete cascade,previous_expense_id uuid,next_expense_id uuid,created_at timestamptz not null default now());
alter table public.payment_link_history enable row level security;
grant select on public.payment_link_history to authenticated;
create policy payment_link_history_own on public.payment_link_history for select to authenticated using(profile_id=auth.uid());
create function public.check_expense_payment_link() returns trigger language plpgsql security definer set search_path='' as $$
declare cost public.project_expenses;
begin
 if new.expense_id is not null then
  select * into cost from public.project_expenses where id=new.expense_id;
  if auth.uid() is null or new.profile_id<>auth.uid() or cost.owner_id<>auth.uid() or cost.id is null or new.linked_project_id is distinct from cost.project_id or new.direction<>'out' or new.currency_code<>'AUD' then raise exception 'Choose an AUD expense in your own project'; end if;
  if tg_op='INSERT' or new.expense_id is distinct from old.expense_id then
   if cost.payment_status='paid' and not exists(select 1 from public.financial_transactions where expense_id=cost.id) then raise exception 'This cost is already marked paid. Use an unpaid cost to avoid counting it twice'; end if;
  end if;
 end if;
 if tg_op='UPDATE' and new.expense_id is distinct from old.expense_id then
  insert into public.payment_link_history(profile_id,transaction_id,previous_expense_id,next_expense_id) values(new.profile_id,new.id,old.expense_id,new.expense_id);
 end if;
 return new;
end; $$;
revoke all on function public.check_expense_payment_link() from public,anon,authenticated;
create trigger expense_payment_link before insert or update on public.financial_transactions for each row execute function public.check_expense_payment_link();
create function public.link_payment_to_cost(p_transaction uuid,p_expense uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare payment public.financial_transactions; cost public.project_expenses; target uuid:=p_expense;
begin
 select * into payment from public.financial_transactions where id=p_transaction for update;
 if auth.uid() is null or payment.id is null or payment.profile_id<>auth.uid() or payment.direction<>'out' or payment.currency_code<>'AUD' or payment.linked_project_id is null then raise exception 'Choose an AUD outgoing payment linked to your project'; end if;
 if payment.expense_id is not null then
  if target is null or target=payment.expense_id then return payment.expense_id; end if;
  raise exception 'This payment is already linked to a cost';
 end if;
 if not exists(select 1 from public.projects where id=payment.linked_project_id and owner_id=auth.uid()) then raise exception 'Project owner access required'; end if;
 if target is null then
  insert into public.project_expenses(owner_id,project_id,title,category,estimate_cents,actual_cents,payment_status,incurred_on,counterparty_label)
  values(auth.uid(),payment.linked_project_id,payment.description,'General',payment.total_cents,payment.total_cents,'pending',payment.occurred_at::date,payment.counterparty_label) returning id into target;
 end if;
 update public.financial_transactions set expense_id=target where id=p_transaction;
 return target;
end; $$;
revoke all on function public.link_payment_to_cost(uuid,uuid) from public,anon;
grant execute on function public.link_payment_to_cost(uuid,uuid) to authenticated;

create table public.budget_groups(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),name text not null check(length(trim(name)) between 1 and 80),project_ids uuid[] not null default '{}',created_at timestamptz not null default now(),unique(owner_id,name));
alter table public.budget_groups enable row level security;
grant select,insert,update,delete on public.budget_groups to authenticated;
create policy budget_groups_own on public.budget_groups for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
-- Retire demo checkout; historical orders and receipts remain available.
revoke execute on function public.place_order_from_cart(uuid[]) from authenticated,anon,public;
create index payment_link_history_profile_idx on public.payment_link_history(profile_id);
create index payment_link_history_transaction_idx on public.payment_link_history(transaction_id);
