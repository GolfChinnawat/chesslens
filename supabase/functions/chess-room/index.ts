import { createClient } from 'npm:@supabase/supabase-js@2.119.2'
import { roomChange, RoomError, type Room } from './rules.ts'

/* global Deno */
const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers })
const ids = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return respond({ error: 'method' }, 405)
  try {
    const token = /^Bearer (\S+)$/i.exec(
      request.headers.get('authorization') ?? '',
    )?.[1]
    if (!token) return respond({ error: 'sign_in' }, 401)
    const { data: auth, error: authError } = await db.auth.getUser(token)
    if (authError || !auth.user || auth.user.is_anonymous)
      return respond({ error: 'sign_in' }, 401)
    const raw = await request.text()
    if (raw.length > 1024) return respond({ error: 'invalid_request' }, 400)
    const body = JSON.parse(raw)
    if (!['create', 'join', 'move', 'resign', 'timeout'].includes(body?.action))
      return respond({ error: 'invalid_action' }, 400)

    if (body.action === 'create') {
      if (![3, 5, 10, 15].includes(body.minutes))
        return respond({ error: 'invalid_time' }, 400)
      const ms = body.minutes * 60_000
      const { data, error } = await db
        .from('online_rooms')
        .insert({ white_id: auth.user.id, white_ms: ms, black_ms: ms })
        .select()
        .single()
      if (!error) return respond({ room: data, now: Date.now() })
      if (error.code !== '23505') throw error
      const existing = await db
        .from('online_rooms')
        .select()
        .eq('white_id', auth.user.id)
        .is('black_id', null)
        .maybeSingle()
      if (existing.error) throw existing.error
      return existing.data
        ? respond({ room: existing.data, now: Date.now() })
        : respond({ error: 'room_changed' }, 409)
    }

    const byCode = body.action === 'join' && !body.room
    const code =
      typeof body.code === 'string'
        ? body.code.replace(/[\s-]/g, '').toUpperCase()
        : ''
    if (
      byCode
        ? !/^[0-9A-F]{10}$/.test(code)
        : typeof body.room !== 'string' || !ids.test(body.room)
    )
      return respond({ error: byCode ? 'invalid_code' : 'invalid_room' }, 400)
    const { data, error } = await db
      .from('online_rooms')
      .select()
      .eq(byCode ? 'room_code' : 'id', byCode ? code : body.room)
      .maybeSingle()
    if (error) throw error
    if (!data) return respond({ error: 'room_unavailable' }, 404)
    const room = data as Room
    const now = Date.now()
    const patch = roomChange(room, auth.user.id, body.action, body.move, now)
    if (!Object.keys(patch).length) return respond({ room, now })
    if (body.action !== 'join' && body.revision !== room.revision)
      return respond({ error: 'room_changed' }, 409)
    const updated = await db
      .from('online_rooms')
      .update({
        ...patch,
        revision: room.revision + 1,
        updated_at: new Date(now).toISOString(),
      })
      .eq('id', room.id)
      .eq('revision', room.revision)
      .select()
      .maybeSingle()
    if (updated.error) throw updated.error
    return updated.data
      ? respond({ room: updated.data, now })
      : respond({ error: 'room_changed' }, 409)
  } catch (error) {
    if (error instanceof RoomError)
      return respond({ error: error.message }, error.status)
    if (error instanceof SyntaxError)
      return respond({ error: 'invalid_request' }, 400)
    console.error('Chess room request failed')
    return respond({ error: 'unavailable' }, 500)
  }
})
