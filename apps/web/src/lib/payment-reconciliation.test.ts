// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, it, expect } from 'vitest'
const db = new PGlite()
const me = '00000000-0000-0000-0000-000000000001',
  other = '00000000-0000-0000-0000-000000000002',
  project = '10000000-0000-0000-0000-000000000001'
const payment = '20000000-0000-0000-0000-000000000001',
  cost = '30000000-0000-0000-0000-000000000001'
beforeAll(async () => {
  await db.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated;
 create table profiles(id uuid primary key);create table projects(id uuid primary key,owner_id uuid);
 create table project_expenses(id uuid primary key default gen_random_uuid(),owner_id uuid,project_id uuid,title text,category text,estimate_cents integer,actual_cents integer,payment_status text,incurred_on date,counterparty_label text);
 create table financial_transactions(id uuid primary key,profile_id uuid,linked_project_id uuid,direction text,currency_code text,description text,total_cents integer,status text,occurred_at timestamptz default now(),counterparty_label text);
 create function place_order_from_cart(uuid[]) returns void language sql as $$select$$;
 grant select,insert,update,delete on all tables in schema public to authenticated;`)
  await db.exec(
    readFileSync(
      new URL(
        '../../../../supabase/migrations/20261127031338_project_payment_reconciliation.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await db.query('insert into profiles values($1),($2)', [me, other])
  await db.query('insert into projects values($1,$2)', [project, me])
  await db.query(
    "insert into project_expenses(id,owner_id,project_id,title,estimate_cents,actual_cents,payment_status) values($1,$2,$3,'Catering',70000,0,'pending')",
    [cost, me, project],
  )
  await db.query(
    "insert into financial_transactions(id,profile_id,linked_project_id,direction,currency_code,description,total_cents,status) values($1,$2,$3,'out','AUD','Part payment',30000,'settled')",
    [payment, me, project],
  )
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [me])
  await db.exec('set role authenticated')
}, 30000)
afterAll(() => db.close())
it('links and retries without creating a duplicate cost or losing history', async () => {
  await db.query('select link_payment_to_cost($1,$2)', [payment, cost])
  await db.query('select link_payment_to_cost($1,$2)', [payment, cost])
  expect((await db.query('select count(*)::int n from project_expenses')).rows).toEqual([{ n: 1 }])
  expect((await db.query('select count(*)::int n from payment_link_history')).rows).toEqual([{ n: 1 }])
})
it('rejects linking another account payment', async () => {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other])
  await expect(db.query('select link_payment_to_cost($1,$2)', [payment, cost])).rejects.toThrow(
    'your project',
  )
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [me])
})
it('disables demo orders and isolates saved budget groups', async () => {
  await expect(db.query('select place_order_from_cart(null)')).rejects.toThrow(/permission denied/)
  await db.query("insert into budget_groups(owner_id,name,project_ids) values($1,'Life',array[$2::uuid])", [
    me,
    project,
  ])
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other])
  expect((await db.query('select * from budget_groups')).rows).toEqual([])
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [me])
})
