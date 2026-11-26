import { readFileSync } from 'node:fs'
import { Chess } from 'chess.js'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
import { roomChange, type Room } from '../supabase/functions/chess-room/rules'

const white = '8d7be724-a9f0-4f3e-a854-edf652e2ec94'
const black = '93869248-0c58-4f84-a0d8-207186ee6c2b'
const outsider = '9774c60d-85da-48ea-a275-6d955bb937d0'
const now = Date.parse('2026-01-01T00:00:00Z')
const waiting: Room = {
  id: 'b6e429b0-87cc-42b6-881f-90e2916b4a81',
  white_id: white,
  black_id: null,
  revision: 0,
  turn_started_at: null,
  white_ms: 180000,
  black_ms: 180000,
  pgn: '',
  result: null,
  reason: null,
}

it('starts a clock on join and rejects outsiders, illegal moves and wrong turns', () => {
  expect(roomChange(waiting, white, 'join', null, now)).toEqual({})
  const room = { ...waiting, ...roomChange(waiting, black, 'join', null, now) }
  expect(room.black_id).toBe(black)
  expect(() => roomChange(room, outsider, 'join', null, now)).toThrow(
    'room_unavailable',
  )
  expect(() => roomChange(room, black, 'move', 'e7e5', now)).toThrow(
    'not_your_turn',
  )
  expect(() => roomChange(room, white, 'move', 'e2e5', now)).toThrow(
    'illegal_move',
  )
  const moved = {
    ...room,
    ...roomChange(room, white, 'move', 'e2e4', now + 1000),
  }
  expect([moved.white_ms, moved.black_ms]).toEqual([179000, 180000])
  const game = new Chess()
  game.loadPgn(moved.pgn)
  expect(game.history()).toEqual(['e4'])
  expect(roomChange(moved, black, 'move', 'e7e5', now + 181000)).toMatchObject({
    result: '1-0',
    reason: 'timeout',
    black_ms: 0,
  })
  expect(roomChange(moved, black, 'resign', null, now + 2000)).toMatchObject({
    result: '1-0',
    reason: 'resign',
    black_ms: 179000,
  })
})

it('isolates live room reads, rejects client writes and admits a single join', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        'select current_setting(''request.jwt.claim.sub'', true)::uuid';
      grant usage on schema auth to authenticated;
      insert into auth.users values ('${white}'), ('${black}'), ('${outsider}');
      create publication supabase_realtime;
    `)
    await db.exec(
      readFileSync(
        new URL(
          '../supabase/migrations/20261126191330_online_rooms.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    )
    await db.exec('set role service_role')
    await db.query(
      'insert into online_rooms(id,white_id,white_ms,black_ms) values ($1,$2,180000,180000)',
      [waiting.id, white],
    )
    expect(
      (
        await db.query(
          'update online_rooms set black_id=$1, revision=1 where id=$2 and revision=0',
          [black, waiting.id],
        )
      ).affectedRows,
    ).toBe(1)
    expect(
      (
        await db.query(
          'update online_rooms set black_id=$1, revision=1 where id=$2 and revision=0',
          [outsider, waiting.id],
        )
      ).affectedRows,
    ).toBe(0)
    await db.exec('reset role; set role authenticated')
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      outsider,
    ])
    expect((await db.query('select * from online_rooms')).rows).toEqual([])
    for (const player of [white, black]) {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
        player,
      ])
      expect((await db.query('select * from online_rooms')).rows).toHaveLength(
        1,
      )
      await expect(
        db.query('update online_rooms set white_ms=900000'),
      ).rejects.toThrow()
    }
  } finally {
    await db.close()
  }
}, 15000)
