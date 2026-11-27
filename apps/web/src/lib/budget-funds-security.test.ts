// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, it, expect } from 'vitest'
const db = new PGlite()
const owner = '00000000-0000-0000-0000-000000000001',
  other = '00000000-0000-0000-0000-000000000002'
const project = '10000000-0000-0000-0000-000000000001',
  foreignProject = '10000000-0000-0000-0000-000000000002'
const fund = '20000000-0000-0000-0000-000000000001',
  foreignFund = '20000000-0000-0000-0000-000000000002'
async function as(id: string) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
  await db.exec('set role authenticated')
}
beforeAll(async () => {
  await db.exec(`create role authenticated; create role anon; create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth to authenticated,anon;
  create table profiles(id uuid primary key); create table projects(id uuid primary key,owner_id uuid references profiles,budget_cents integer);
  alter table projects enable row level security; create policy shared_projects on projects for select to authenticated using(true); grant select on projects to authenticated;`)
  await db.query('insert into profiles values($1),($2)', [owner, other])
  await db.query('insert into projects values($1,$2,12345),($3,$4,50000)', [
    project,
    owner,
    foreignProject,
    other,
  ])
  for (const name of [
    '20261127032933_private_project_budgets.sql',
    '20261127224058_integrated_budget_funds.sql',
  ])
    await db.exec(readFileSync(new URL(`../../../../supabase/migrations/${name}`, import.meta.url), 'utf8'))
  await as(owner)
  await db.query("insert into budget_funds(id,name,budget_cents) values($1,'Personal',50000)", [fund])
  await db.exec('insert into money_budget_settings(budget_cents) values(100000)')
  await as(other)
  await db.query("insert into budget_funds(id,name,budget_cents) values($1,'Other',80000)", [foreignFund])
}, 30000)
afterAll(() => db.close())
it('keeps overall and group budgets private even when project metadata is shared', async () => {
  await as(other)
  expect((await db.query('select * from money_budget_settings')).rows).toEqual([])
  expect((await db.query('select id from budget_funds')).rows).toEqual([{ id: foreignFund }])
  await expect(
    db.query('insert into money_budget_settings(owner_id,budget_cents) values($1,1)', [owner]),
  ).rejects.toThrow(/row-level security/)
  expect(
    (await db.query('update budget_funds set budget_cents=1 where id=$1 returning id', [fund])).rows,
  ).toEqual([])
})
it('prevents moving a project into another owner’s group or allocating someone else’s project', async () => {
  await as(owner)
  await expect(
    db.query('update project_budget_limits set fund_id=$1 where project_id=$2', [foreignFund, project]),
  ).rejects.toThrow(/project_budget_fund_owner/)
  await expect(
    db.query(
      'insert into project_budget_limits(project_id,fund_id) values($1,$2) on conflict(project_id) do update set fund_id=excluded.fund_id',
      [foreignProject, fund],
    ),
  ).rejects.toThrow(/row-level security/)
  await expect(db.query('update budget_funds set owner_id=$1 where id=$2', [other, fund])).rejects.toThrow(
    /row-level security/,
  )
})
it('assigns one parent while preserving the existing project budget, including on later budget edits', async () => {
  await as(owner)
  await db.query(
    'insert into project_budget_limits(project_id,fund_id) values($1,$2) on conflict(project_id) do update set fund_id=excluded.fund_id',
    [project, fund],
  )
  expect(
    (await db.query('select budget_cents,fund_id from project_budget_limits where project_id=$1', [project]))
      .rows,
  ).toEqual([{ budget_cents: 12345, fund_id: fund }])
  await db.query(
    'insert into project_budget_limits(project_id,budget_cents) values($1,0) on conflict(project_id) do update set budget_cents=excluded.budget_cents',
    [project],
  )
  expect(
    (await db.query('select budget_cents,fund_id from project_budget_limits where project_id=$1', [project]))
      .rows,
  ).toEqual([{ budget_cents: 0, fund_id: fund }])
})
it('rejects negative budgets and blank names, allows zero or unset', async () => {
  await as(owner)
  await expect(db.exec('update money_budget_settings set budget_cents=-1')).rejects.toThrow(
    /check constraint/,
  )
  await expect(db.query("update budget_funds set name=' ' where id=$1", [fund])).rejects.toThrow(
    /check constraint/,
  )
  await db.exec('update money_budget_settings set budget_cents=0')
  expect((await db.query('select budget_cents from money_budget_settings')).rows).toEqual([
    { budget_cents: 0 },
  ])
  await db.exec('update money_budget_settings set budget_cents=null')
})
it('removing a group preserves projects and their budgets and makes them ungrouped', async () => {
  await as(owner)
  await db.query('delete from budget_funds where id=$1', [fund])
  expect(
    (await db.query('select budget_cents,fund_id from project_budget_limits where project_id=$1', [project]))
      .rows,
  ).toEqual([{ budget_cents: 0, fund_id: null }])
})
it('denies anonymous access', async () => {
  await db.exec('reset role; set role anon')
  await expect(db.exec('select * from money_budget_settings')).rejects.toThrow(/permission denied/)
  await expect(db.exec('select * from budget_funds')).rejects.toThrow(/permission denied/)
})
