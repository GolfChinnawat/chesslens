import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, test } from 'vitest'

const db = new PGlite()
const first = '8d7be724-a9f0-4f3e-a854-edf652e2ec94'
const second = '93869248-0c58-4f84-a0d8-207186ee6c2b'
const payload = JSON.stringify({
  game: { pgn: '1. e4 *' },
  depth: 12,
  positions: [{}, {}],
  evaluations: [{}, {}],
})

beforeAll(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth to authenticated, anon;
    insert into auth.users values ('${first}'), ('${second}');
  `)
  await db.exec(
    readFileSync(
      new URL(
        '../supabase/migrations/202611220001_accounts.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
}, 15000)

afterAll(() => db.close())

async function actAs(user: string) {
  await db.exec('reset role; set role authenticated;')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    user,
  ])
}

test('isolates games and reviews, prevents forged ownership, and cascades account deletion', async () => {
  await actAs(first)
  const save =
    "select public.save_review('1. e4 *', 'pgn', '*', null, null, null, 12, $1, '[]') as id"
  const {
    rows: [{ id }],
  } = await db.query<{ id: string }>(save, [payload])
  const repeated = await db.query<{ id: string }>(save, [payload])
  expect(repeated.rows[0].id).toBe(id)
  expect((await db.query('select * from reviews')).rows).toHaveLength(1)
  await expect(db.query(save, ['{}'])).rejects.toThrow()
  await actAs(second)
  expect((await db.query('select * from games')).rows).toEqual([])
  expect((await db.query('select * from reviews')).rows).toEqual([])
  expect(
    (await db.query('delete from games where id=$1 returning id', [id])).rows,
  ).toEqual([])
  await expect(
    db.query('insert into games(user_id,pgn) values ($1,$2)', [
      first,
      '1. d4 *',
    ]),
  ).rejects.toThrow()
  await expect(
    db.query('insert into reviews(game_id,depth,payload) values ($1,16,$2)', [
      id,
      payload,
    ]),
  ).rejects.toThrow()
  await db.query(save, [payload])
  await db.query('select public.delete_my_account()')
  await db.exec('reset role')
  expect((await db.query('select id from auth.users')).rows).toEqual([
    { id: first },
  ])
  expect((await db.query('select id from games')).rows).toEqual([{ id }])
  await db.exec('set role anon')
  await expect(db.query('select public.delete_my_account()')).rejects.toThrow()
})
