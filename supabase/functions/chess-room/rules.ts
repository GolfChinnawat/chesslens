import { Chess } from 'chess.js'

export type Room = {
  id: string
  white_id: string
  black_id: string | null
  revision: number
  turn_started_at: string | null
  white_ms: number
  black_ms: number
  pgn: string
  result: string | null
  reason: string | null
}

export class RoomError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

export function roomChange(
  room: Room,
  user: string,
  action: string,
  move: unknown,
  now: number,
): Partial<Room> {
  if (action === 'join' && !room.black_id && room.white_id !== user) {
    return { black_id: user, turn_started_at: new Date(now).toISOString() }
  }

  const side =
    room.white_id === user ? 'w' : room.black_id === user ? 'b' : null
  if (!side) throw new RoomError('room_unavailable', 404)
  if (action === 'join') return {}
  if (room.result || !room.turn_started_at)
    throw new RoomError('room_not_playing', 409)
  const game = new Chess()
  if (room.pgn) game.loadPgn(room.pgn)
  const turn = game.turn()
  const clock = turn === 'w' ? 'white_ms' : 'black_ms'
  const left = Math.max(
    0,
    room[clock] - Math.max(0, now - Date.parse(room.turn_started_at)),
  )
  const win = (color: 'w' | 'b') => (color === 'w' ? '1-0' : '0-1')
  const other = (color: 'w' | 'b') => (color === 'w' ? 'b' : 'w')

  function finish(result: string, reason: string): Partial<Room> {
    game.setHeader('Result', result)
    return {
      [clock]: left,
      result,
      reason,
      pgn: game.pgn(),
      turn_started_at: null,
    }
  }

  // Flag fall takes precedence over a move or resignation arriving after the deadline.
  if (!left) return finish(win(other(turn)), 'timeout')
  if (action === 'timeout') return {}
  if (action === 'resign') return finish(win(other(side)), 'resign')
  if (action !== 'move') throw new RoomError('invalid_action')
  if (turn !== side) throw new RoomError('not_your_turn', 409)
  if (typeof move !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))
    throw new RoomError('invalid_move')
  try {
    game.move(move)
  } catch {
    throw new RoomError('illegal_move')
  }
  if (game.isCheckmate()) return finish(win(side), 'mate')
  if (game.isDraw()) return finish('1/2-1/2', 'draw')
  return {
    [clock]: left,
    pgn: game.pgn(),
    turn_started_at: new Date(now).toISOString(),
  }
}
