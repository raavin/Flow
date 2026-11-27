-- Project metadata is shared with accepted members. Budget limits are not.
create table public.project_budget_limits (
 project_id uuid primary key references public.projects(id) on delete cascade,
 owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 budget_cents integer check(budget_cents is null or budget_cents>=0)
);
alter table public.project_budget_limits enable row level security;
grant select,insert,update,delete on public.project_budget_limits to authenticated;
create policy project_budget_limits_owner on public.project_budget_limits for all to authenticated
 using(owner_id=auth.uid())
 with check(owner_id=auth.uid() and exists(select 1 from public.projects where id=project_id and owner_id=auth.uid()));
create index project_budget_limits_owner_idx on public.project_budget_limits(owner_id);
insert into public.project_budget_limits(project_id,owner_id,budget_cents)
 select id,owner_id,budget_cents from public.projects where budget_cents is not null;
-- Keep the deprecated column as an empty compatibility field. Its contents can
-- never leak through SELECT * or a forgotten metadata query in an older client.
update public.projects set budget_cents=null where budget_cents is not null;
alter table public.projects add constraint projects_budget_is_private check(budget_cents is null);
