// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, it, expect } from 'vitest'
const db = new PGlite()
const owner = '00000000-0000-0000-0000-000000000001',
  member = '00000000-0000-0000-0000-000000000002',
  project = '10000000-0000-0000-0000-000000000001'
async function as(id: string) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
  await db.exec('set role authenticated')
}
beforeAll(async () => {
  await db.exec(`create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated;
 create table profiles(id uuid primary key);create table projects(id uuid primary key,owner_id uuid references profiles,budget_cents integer);
 alter table projects enable row level security;create policy projects_shared on projects for select to authenticated using(true);create policy projects_owner on projects for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
 grant select,insert,update,delete on projects to authenticated;`)
  await db.query('insert into profiles values($1),($2)', [owner, member])
  await db.query('insert into projects values($1,$2,123450)', [project, owner])
  await db.exec(
    readFileSync(
      new URL('../../../../supabase/migrations/20261127032933_private_project_budgets.sql', import.meta.url),
      'utf8',
    ),
  )
}, 30000)
afterAll(() => db.close())
it('preserves the exact limit for the owner while shared metadata contains no financial value', async () => {
  await as(owner)
  expect((await db.query('select budget_cents from project_budget_limits')).rows).toEqual([
    { budget_cents: 123450 },
  ])
  await as(member)
  expect((await db.query('select budget_cents from projects')).rows).toEqual([{ budget_cents: null }])
  expect((await db.query('select * from project_budget_limits')).rows).toEqual([])
  await expect(
    db.query(
      'insert into project_budget_limits(project_id,budget_cents) values($1,10) on conflict(project_id) do update set budget_cents=10',
      [project],
    ),
  ).rejects.toThrow(/row-level security/)
})
it('supports an explicit zero or no limit and prevents later metadata leakage', async () => {
  await as(owner)
  await db.query(
    'insert into project_budget_limits(project_id,budget_cents) values($1,0) on conflict(project_id) do update set budget_cents=excluded.budget_cents',
    [project],
  )
  expect((await db.query('select budget_cents from project_budget_limits')).rows).toEqual([
    { budget_cents: 0 },
  ])
  await db.query('update project_budget_limits set budget_cents=null where project_id=$1', [project])
  expect((await db.query('select budget_cents from project_budget_limits')).rows).toEqual([
    { budget_cents: null },
  ])
  await expect(db.query('update projects set budget_cents=100 where id=$1', [project])).rejects.toThrow(
    'projects_budget_is_private',
  )
})
