-- Private budgeting and an opt-in marketplace brief. No payment processing.
create table public.project_budget_allocations (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
 project_id uuid not null references public.projects(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100), limit_cents integer not null check(limit_cents>=0),
 unique(project_id,name), unique(id,project_id)
);
alter table public.project_budget_allocations enable row level security;
create policy allocations_owner on public.project_budget_allocations for all to authenticated
 using(owner_id=auth.uid()) with check(owner_id=auth.uid() and exists(select 1 from public.projects p where p.id=project_id and p.owner_id=auth.uid()));
revoke all on public.project_budget_allocations from anon,authenticated;
grant select,insert,delete on public.project_budget_allocations to authenticated;
grant update(name,limit_cents) on public.project_budget_allocations to authenticated;
alter table public.project_expenses add column allocation_id uuid;
alter table public.project_expenses add constraint expense_allocation_project foreign key(allocation_id,project_id) references public.project_budget_allocations(id,project_id);

create table public.marketplace_requests (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
 project_id uuid references public.projects(id), allocation_id uuid,
 title text not null check(length(trim(title)) between 1 and 160), description text not null check(length(trim(description)) between 1 and 6000),
 context_note text not null default '' check(length(context_note)<=4000), location_label text not null default '' check(length(location_label)<=160),
 due_on date, budget_cents integer check(budget_cents>=0),
 status text not null default 'open' check(status in ('open','assigned','completed','cancelled')),
 created_at timestamptz not null default now(),
 foreign key(allocation_id,project_id) references public.project_budget_allocations(id,project_id),
 check(allocation_id is null or project_id is not null)
);
create table public.supplier_quotes (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.marketplace_requests(id),
 requester_id uuid not null references public.profiles(id), supplier_id uuid not null references public.profiles(id), supplier_label text not null,
 amount_cents integer not null check(amount_cents>0), details text not null check(length(trim(details)) between 1 and 6000),
 available_on date, valid_until date, status text not null default 'pending' check(status in ('pending','withdrawn','accepted','declined')),
 expense_id uuid references public.project_expenses(id), created_at timestamptz not null default now(),
 unique(request_id,supplier_id), check(requester_id<>supplier_id)
);
create unique index one_accepted_quote on public.supplier_quotes(request_id) where status='accepted';
create table public.quote_messages (
 id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.supplier_quotes(id),
 sender_id uuid not null references public.profiles(id), body text not null check(length(trim(body)) between 1 and 3000), created_at timestamptz not null default now()
);
alter table public.marketplace_requests enable row level security;
alter table public.supplier_quotes enable row level security;
alter table public.quote_messages enable row level security;
create policy quotes_parties on public.supplier_quotes for select to authenticated using(auth.uid() in (supplier_id,requester_id));
create policy requests_visible on public.marketplace_requests for select to authenticated using(status='open' or owner_id=auth.uid() or exists(select 1 from public.supplier_quotes q where q.request_id=marketplace_requests.id and q.supplier_id=auth.uid()));
create policy messages_read on public.quote_messages for select to authenticated using(exists(select 1 from public.supplier_quotes q where q.id=quote_id and auth.uid() in(q.supplier_id,q.requester_id)));
create policy messages_send on public.quote_messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.supplier_quotes q where q.id=quote_id and auth.uid() in(q.supplier_id,q.requester_id)));
revoke all on public.marketplace_requests,public.supplier_quotes,public.quote_messages from anon,authenticated;
grant select on public.marketplace_requests,public.supplier_quotes,public.quote_messages to authenticated;
grant insert on public.quote_messages to authenticated;

create function public.publish_supplier_request(p_title text,p_description text,p_context text default '',p_location text default '',p_due date default null,p_budget integer default null,p_project uuid default null,p_allocation uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if p_project is not null and not exists(select 1 from public.projects where id=p_project and owner_id=auth.uid()) then raise exception 'Project not owned'; end if;
 insert into public.marketplace_requests(owner_id,title,description,context_note,location_label,due_on,budget_cents,project_id,allocation_id)
 values(auth.uid(),trim(p_title),trim(p_description),p_context,p_location,p_due,p_budget,p_project,p_allocation) returning id into result;
 return result;
end $$;
create function public.submit_supplier_quote(p_request uuid,p_amount integer,p_details text,p_available date default null,p_valid date default null) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.marketplace_requests; result uuid; label text;
begin
 select * into r from public.marketplace_requests where id=p_request for update;
 if auth.uid() is null or r.id is null or r.owner_id=auth.uid() or r.status<>'open' then raise exception 'Request is not available for quoting'; end if;
 if p_valid<current_date then raise exception 'Quote validity must be today or later'; end if;
 select coalesce(nullif(b.business_name,''),nullif(p.first_name,''),'Supplier') into label from public.profiles p left join public.business_profiles b on b.id=p.id where p.id=auth.uid();
 insert into public.supplier_quotes(request_id,requester_id,supplier_id,supplier_label,amount_cents,details,available_on,valid_until)
 values(r.id,r.owner_id,auth.uid(),label,p_amount,trim(p_details),p_available,p_valid)
 on conflict(request_id,supplier_id) do update set amount_cents=excluded.amount_cents,details=excluded.details,available_on=excluded.available_on,valid_until=excluded.valid_until,status='pending'
 where supplier_quotes.status in ('pending','withdrawn') returning id into result;
 if result is null then raise exception 'Quote can no longer be changed'; end if;
 return result;
end $$;
create function public.withdraw_supplier_quote(p_quote uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.marketplace_requests;
begin
 select * into r from public.marketplace_requests where id=(select request_id from public.supplier_quotes where id=p_quote) for update;
 if r.status<>'open' then raise exception 'Request is closed'; end if;
 update public.supplier_quotes set status='withdrawn' where id=p_quote and supplier_id=auth.uid() and status='pending';
 if not found then raise exception 'Quote cannot be withdrawn'; end if;
end $$;
create function public.choose_supplier_quote(p_quote uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.marketplace_requests; q public.supplier_quotes; cost uuid;
begin
 select * into r from public.marketplace_requests where id=(select request_id from public.supplier_quotes where id=p_quote) for update;
 if auth.uid() is null or r.id is null or r.owner_id<>auth.uid() then raise exception 'Only the requester can choose'; end if;
 select * into q from public.supplier_quotes where id=p_quote;
 if q.status='accepted' then return q.expense_id; end if;
 if r.status<>'open' or q.status<>'pending' or q.valid_until<current_date then raise exception 'Quote is no longer available'; end if;
 if r.project_id is not null then
 insert into public.project_expenses(owner_id,project_id,allocation_id,category,title,estimate_cents,actual_cents,payment_status)
 values(r.owner_id,r.project_id,r.allocation_id,'Supplier quote',r.title,q.amount_cents,0,'pending') returning id into cost;
 end if;
 update public.supplier_quotes set status='declined' where request_id=r.id and status='pending' and id<>q.id;
 update public.supplier_quotes set status='accepted',expense_id=cost where id=q.id;
 update public.marketplace_requests set status='assigned' where id=r.id;
 return cost;
end $$;
create function public.close_supplier_request(p_request uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare r public.marketplace_requests;
begin
 select * into r from public.marketplace_requests where id=p_request for update;
 if auth.uid() is null or r.id is null or r.owner_id<>auth.uid() then raise exception 'Only the requester can close'; end if;
 if not ((r.status='open' and p_status='cancelled') or (r.status='assigned' and p_status='completed')) then raise exception 'Invalid request transition'; end if;
 update public.marketplace_requests set status=p_status where id=r.id;
 if p_status='cancelled' then update public.supplier_quotes set status='declined' where request_id=r.id and status='pending'; end if;
end $$;
revoke all on function public.publish_supplier_request(text,text,text,text,date,integer,uuid,uuid),public.submit_supplier_quote(uuid,integer,text,date,date),public.withdraw_supplier_quote(uuid),public.choose_supplier_quote(uuid),public.close_supplier_request(uuid,text) from public,anon;
grant execute on function public.publish_supplier_request(text,text,text,text,date,integer,uuid,uuid),public.submit_supplier_quote(uuid,integer,text,date,date),public.withdraw_supplier_quote(uuid),public.choose_supplier_quote(uuid),public.close_supplier_request(uuid,text) to authenticated;

create table public.expense_receipts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
 expense_id uuid not null references public.project_expenses(id), storage_path text not null unique,
 file_name text not null check(length(file_name)<=255), mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
 size_bytes integer not null check(size_bytes>0 and size_bytes<=10485760), created_at timestamptz not null default now()
);
alter table public.expense_receipts enable row level security;
create policy receipts_read on public.expense_receipts for select to authenticated using(owner_id=auth.uid());
create policy receipts_delete on public.expense_receipts for delete to authenticated using(owner_id=auth.uid());
create policy receipts_insert on public.expense_receipts for insert to authenticated with check(owner_id=auth.uid() and split_part(storage_path,'/',1)=auth.uid()::text and split_part(storage_path,'/',2)=expense_id::text and exists(select 1 from public.project_expenses e where e.id=expense_id and e.owner_id=auth.uid()));
revoke all on public.expense_receipts from anon,authenticated;
grant select,insert,delete on public.expense_receipts to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('expense-receipts','expense-receipts',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy expense_files_upload on storage.objects for insert to authenticated with check(bucket_id='expense-receipts' and split_part(name,'/',1)=auth.uid()::text and exists(select 1 from public.project_expenses e where e.id::text=split_part(name,'/',2) and e.owner_id=auth.uid()));
create policy expense_files_read on storage.objects for select to authenticated using(bucket_id='expense-receipts' and split_part(name,'/',1)=auth.uid()::text);
create policy expense_files_delete on storage.objects for delete to authenticated using(bucket_id='expense-receipts' and split_part(name,'/',1)=auth.uid()::text);

-- Supporting indexes for RLS lookups and private discussions.
create index request_owner_idx on public.marketplace_requests(owner_id);
create index request_open_idx on public.marketplace_requests(created_at desc) where status='open';
create index quote_supplier_idx on public.supplier_quotes(supplier_id);
create index quote_requester_idx on public.supplier_quotes(requester_id);
create index quote_messages_thread_idx on public.quote_messages(quote_id,created_at);
create index expense_receipts_expense_idx on public.expense_receipts(expense_id);
