// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, it, expect } from 'vitest'
const db = new PGlite()
const owner = '00000000-0000-0000-0000-000000000001',
  supplier = '00000000-0000-0000-0000-000000000002',
  stranger = '00000000-0000-0000-0000-000000000003'
const project = '00000000-0000-0000-0000-000000000011',
  otherProject = '00000000-0000-0000-0000-000000000012'
async function as(user: string) {
  await db.exec('reset role; set role authenticated')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user])
}
async function scalar(sql: string, args: unknown[] = []) {
  return (await db.query<Record<string, unknown>>(sql, args)).rows[0]?.value
}
let request: string,
  quote: string,
  otherQuote: string,
  allocation: string,
  cost: string
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth,storage to authenticated,anon;
 create table public.profiles(id uuid primary key,first_name text);
 create table public.business_profiles(id uuid primary key,business_name text);
 create table public.projects(id uuid primary key,owner_id uuid);
 create table public.project_expenses(id uuid primary key default gen_random_uuid(),owner_id uuid,project_id uuid references public.projects(id),category text,title text,estimate_cents integer,actual_cents integer,payment_status text);
 alter table public.projects enable row level security;
 create policy own on public.projects for all using(owner_id=auth.uid()) with check(owner_id=auth.uid());
 alter table public.project_expenses enable row level security;
 create policy own on public.project_expenses for all using(owner_id=auth.uid()) with check(owner_id=auth.uid());
 grant select,insert,update,delete on public.projects,public.project_expenses to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to authenticated;
 insert into public.profiles values('${owner}','Owner'),('${supplier}','Supplier'),('${stranger}','Other supplier');
 insert into public.projects values('${project}','${owner}'),('${otherProject}','${stranger}');`)
  await db.exec(
    readFileSync(
      new URL(
        '../../../../supabase/migrations/20261126015336_budget_receipts_supplier_requests.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
}, 30000)
afterAll(async () => {
  await db.close()
})
it('keeps allocations private and blocks allocation to another owner project', async () => {
  await as(owner)
  allocation = String(
    await scalar(
      "insert into project_budget_allocations(owner_id,project_id,name,limit_cents) values($1,$2,'Venue',10000) returning id as value",
      [owner, project],
    ),
  )
  await expect(
    db.query(
      "insert into project_budget_allocations(owner_id,project_id,name,limit_cents) values($1,$2,'Other',100)",
      [owner, otherProject],
    ),
  ).rejects.toThrow()
  await expect(
    db.query(
      'update project_budget_allocations set project_id=$1 where id=$2',
      [otherProject, allocation],
    ),
  ).rejects.toThrow()
  await as(supplier)
  expect(
    await scalar(
      'select count(*)::int as value from project_budget_allocations',
    ),
  ).toBe(0)
})
it('publishes only owned project briefs and exposes open requests', async () => {
  await as(owner)
  await expect(
    db.query(
      "select publish_supplier_request('Bad','Details','','',null,null,$1,null)",
      [otherProject],
    ),
  ).rejects.toThrow()
  request = String(
    await scalar(
      "select publish_supplier_request('Catering','Dinner for 12','Vegan menu','Melbourne',null,15000,$1,$2) as value",
      [project, allocation],
    ),
  )
  await as(supplier)
  expect(
    await scalar(
      'select title as value from marketplace_requests where id=$1',
      [request],
    ),
  ).toBe('Catering')
  await expect(
    db.query("update marketplace_requests set status='assigned' where id=$1", [
      request,
    ]),
  ).rejects.toThrow()
})
it('keeps competing quotes and discussions private, allows revision and withdrawal', async () => {
  await as(supplier)
  quote = String(
    await scalar(
      "select submit_supplier_quote($1,12000,'Food and delivery included',null,null) as value",
      [request],
    ),
  )
  await as(stranger)
  otherQuote = String(
    await scalar(
      "select submit_supplier_quote($1,14000,'Alternative',null,null) as value",
      [request],
    ),
  )
  expect(
    await scalar('select count(*)::int as value from supplier_quotes'),
  ).toBe(1)
  await expect(
    db.query(
      "insert into quote_messages(quote_id,sender_id,body) values($1,$2,'Spy')",
      [quote, stranger],
    ),
  ).rejects.toThrow()
  await as(supplier)
  await db.query(
    "insert into quote_messages(quote_id,sender_id,body) values($1,$2,'Can deliver at six')",
    [quote, supplier],
  )
  await db.query('select withdraw_supplier_quote($1)', [quote])
  expect(
    await scalar('select status as value from supplier_quotes where id=$1', [
      quote,
    ]),
  ).toBe('withdrawn')
  await db.query(
    "select submit_supplier_quote($1,12500,'Revised incl delivery',null,null)",
    [request],
  )
  await expect(
    db.query('select choose_supplier_quote($1)', [quote]),
  ).rejects.toThrow()
  await as(owner)
  expect(
    await scalar('select count(*)::int as value from supplier_quotes'),
  ).toBe(2)
  expect(
    await scalar('select count(*)::int as value from quote_messages'),
  ).toBe(1)
})
it('atomically records a committed cost exactly once, closes competition and freezes terms', async () => {
  await as(owner)
  cost = String(
    await scalar('select choose_supplier_quote($1) as value', [quote]),
  )
  expect(
    await scalar('select choose_supplier_quote($1) as value', [quote]),
  ).toBe(cost)
  expect(
    await scalar('select count(*)::int as value from project_expenses'),
  ).toBe(1)
  const row = (
    await db.query('select * from project_expenses where id=$1', [cost])
  ).rows[0]
  expect(row).toMatchObject({
    estimate_cents: 12500,
    actual_cents: 0,
    payment_status: 'pending',
    allocation_id: allocation,
  })
  expect(
    await scalar('select status as value from supplier_quotes where id=$1', [
      otherQuote,
    ]),
  ).toBe('declined')
  await expect(
    db.query('select choose_supplier_quote($1)', [otherQuote]),
  ).rejects.toThrow()
  await as(supplier)
  expect(
    await scalar('select count(*)::int as value from marketplace_requests'),
  ).toBe(1)
  await expect(
    db.query("select submit_supplier_quote($1,20000,'Changed',null,null)", [
      request,
    ]),
  ).rejects.toThrow()
  await expect(
    db.query('select withdraw_supplier_quote($1)', [quote]),
  ).rejects.toThrow()
  await expect(
    db.query('update supplier_quotes set amount_cents=1 where id=$1', [quote]),
  ).rejects.toThrow()
  await as(owner)
  await db.query("select close_supplier_request($1,'completed')", [request])
  expect(
    await scalar(
      'select payment_status as value from project_expenses where id=$1',
      [cost],
    ),
  ).toBe('pending')
})
it('protects private receipts and file paths and prevents expense deletion with receipts', async () => {
  await as(owner)
  const path = `${owner}/${cost}/receipt.pdf`
  await db.query(
    "insert into storage.objects(bucket_id,name) values('expense-receipts',$1)",
    [path],
  )
  await db.query(
    "insert into expense_receipts(owner_id,expense_id,storage_path,file_name,mime_type,size_bytes) values($1,$2,$3,'receipt.pdf','application/pdf',10)",
    [owner, cost, path],
  )
  await expect(
    db.query('delete from project_expenses where id=$1', [cost]),
  ).rejects.toThrow()
  await as(supplier)
  expect(
    await scalar('select count(*)::int as value from expense_receipts'),
  ).toBe(0)
  expect(
    await scalar(
      "select count(*)::int as value from storage.objects where bucket_id='expense-receipts'",
    ),
  ).toBe(0)
  await expect(
    db.query(
      "insert into storage.objects(bucket_id,name) values('expense-receipts',$1)",
      [`${supplier}/${cost}/fake.pdf`],
    ),
  ).rejects.toThrow()
  await expect(
    db.query(
      "insert into expense_receipts(owner_id,expense_id,storage_path,file_name,mime_type,size_bytes) values($1,$2,$3,'fake.pdf','application/pdf',10)",
      [supplier, cost, `${supplier}/${cost}/fake.pdf`],
    ),
  ).rejects.toThrow()
})
it('rejects expired quotes and cancels unassigned requests without expenses', async () => {
  await as(owner)
  const r = await scalar(
    "select publish_supplier_request('Other','Details') as value",
  )
  await as(supplier)
  await expect(
    db.query(
      "select submit_supplier_quote($1,100,'Too late',null,current_date-1)",
      [r],
    ),
  ).rejects.toThrow()
  await db.query(
    "select submit_supplier_quote($1,100,'Fine',null,current_date)",
    [r],
  )
  await as(owner)
  await db.query("select close_supplier_request($1,'cancelled')", [r])
  expect(
    await scalar('select count(*)::int as value from project_expenses'),
  ).toBe(1)
  await as(supplier)
  expect(
    await scalar(
      'select status as value from supplier_quotes where request_id=$1',
      [r],
    ),
  ).toBe('declined')
})

it('denies anonymous table access and RPC execution even with a forged subject setting', async () => {
  await db.exec('reset role; set role anon')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner])
  await expect(db.query('select * from supplier_quotes')).rejects.toThrow()
  await expect(db.query("select publish_supplier_request('Bad','Bad')")).rejects.toThrow()
  await expect(db.query('select choose_supplier_quote($1)', [quote])).rejects.toThrow()
})
