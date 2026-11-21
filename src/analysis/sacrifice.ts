import { Chess, type Color } from 'chess.js'
import { classificationConfig as config } from './classificationConfig'

function material(game: Chess, mover: Color) {
  return game
    .board()
    .flat()
    .reduce(
      (sum, piece) =>
        piece
          ? sum +
            (piece.color === mover ? 1 : -1) *
              config.sacrifice.pieces[piece.type]
          : sum,
      0,
    )
}

export function isSacrifice(
  fenBefore: string,
  move: string,
  pv: readonly string[],
) {
  if (pv[0] !== move) return false
  const game = new Chess(fenBefore)
  const mover = game.turn()
  const initial = material(game, mover)
  let lostPiece = false
  try {
    game.move(move)
    for (const uci of pv.slice(1, config.sacrifice.replyPlies + 1)) {
      const reply = game.move(uci)
      if (reply.color !== mover && reply.captured && reply.captured !== 'p')
        lostPiece = true
    }
  } catch {
    return false
  }
  return (
    lostPiece && initial - material(game, mover) >= config.sacrifice.minLoss
  )
}
