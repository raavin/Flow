-- Reuse private receipt storage for standalone payment and income records.
alter table public.expense_receipts alter column expense_id drop not null;
alter table public.expense_receipts add column transaction_id uuid references public.financial_transactions(id);
alter table public.expense_receipts add constraint receipt_one_parent check (num_nonnulls(expense_id, transaction_id) = 1);
create index receipt_transaction_idx on public.expense_receipts(transaction_id) where transaction_id is not null;

drop policy receipts_insert on public.expense_receipts;
create policy receipts_insert on public.expense_receipts for insert to authenticated with check (
 owner_id = (select auth.uid()) and split_part(storage_path,'/',1) = (select auth.uid())::text and (
  (expense_id is not null and transaction_id is null and split_part(storage_path,'/',2) = expense_id::text
   and exists(select 1 from public.project_expenses e where e.id=expense_id and e.owner_id=(select auth.uid())))
  or (transaction_id is not null and expense_id is null and split_part(storage_path,'/',2)='transactions'
   and split_part(storage_path,'/',3)=transaction_id::text
   and exists(select 1 from public.financial_transactions t where t.id=transaction_id and t.profile_id=(select auth.uid())))
 )
);
drop policy expense_files_upload on storage.objects;
create policy expense_files_upload on storage.objects for insert to authenticated with check (
 bucket_id='expense-receipts' and split_part(name,'/',1)=(select auth.uid())::text and (
  exists(select 1 from public.project_expenses e where e.id::text=split_part(name,'/',2) and e.owner_id=(select auth.uid()))
  or (split_part(name,'/',2)='transactions' and exists(select 1 from public.financial_transactions t where t.id::text=split_part(name,'/',3) and t.profile_id=(select auth.uid())))
 )
);
-- Optional details for the shared money-entry form. Existing values are retained.
alter table public.project_expenses add column incurred_on date;
alter table public.project_expenses add column counterparty_label text not null default '' check(length(counterparty_label)<=200);
