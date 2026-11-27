import { Chess, type Color, type Move, type PieceSymbol } from 'chess.js'

export type Outcome = {
  reason:
    | 'mate'
    | 'stalemate'
    | 'repetition'
    | 'fifty'
    | 'material'
    | 'resigned'
    | 'agreed'
  winner: Color | null
}
export type ManualEnd = 'resigned' | 'agreed' | null

export const opponent = (color: Color): Color => (color === 'w' ? 'b' : 'w')

export function getOutcome(
  game: Chess,
  player: Color,
  manualEnd: ManualEnd,
): Outcome | null {
  if (game.isCheckmate())
    return { reason: 'mate', winner: opponent(game.turn()) }
  if (game.isStalemate()) return { reason: 'stalemate', winner: null }
  if (game.isThreefoldRepetition())
    return { reason: 'repetition', winner: null }
  if (game.isDrawByFiftyMoves()) return { reason: 'fifty', winner: null }
  if (game.isInsufficientMaterial()) return { reason: 'material', winner: null }
  if (manualEnd === 'resigned')
    return { reason: 'resigned', winner: opponent(player) }
  if (manualEnd === 'agreed') return { reason: 'agreed', winner: null }
  return null
}

export function gamePgn(game: Chess, player: Color, outcome: Outcome | null) {
  const copy = new Chess()
  copy.loadPgn(game.pgn())
  copy.setHeader('White', player === 'w' ? 'Player' : 'Stockfish')
  copy.setHeader('Black', player === 'b' ? 'Player' : 'Stockfish')
  copy.setHeader(
    'Result',
    outcome
      ? outcome.winner === 'w'
        ? '1-0'
        : outcome.winner === 'b'
          ? '0-1'
          : '1/2-1/2'
      : '*',
  )
  return copy.pgn()
}

export const moveUci = (move: Move) =>
  move.from + move.to + (move.promotion ?? '')
export const initialFen = (moves: Move[], game: Chess) =>
  moves[0]?.before ?? game.fen()

const values: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
}

export function countCaptures(
  moves: readonly Pick<Move, 'captured' | 'color'>[],
) {
  const captures: Record<Color, PieceSymbol[]> = { w: [], b: [] }
  for (const move of moves) {
    if (move.captured) captures[move.color].push(move.captured)
  }
  const order = 'qrbnpk'
  for (const color of ['w', 'b'] as const) {
    captures[color].sort((a, b) => order.indexOf(a) - order.indexOf(b))
  }
  return captures
}

export function summarizeMaterial(moves: Move[], fen: string) {
  const balance = new Chess(fen)
    .board()
    .flat()
    .reduce((sum, piece) => {
      if (!piece) return sum
      return sum + values[piece.type] * (piece.color === 'w' ? 1 : -1)
    }, 0)
  return { captures: countCaptures(moves), balance }
}
