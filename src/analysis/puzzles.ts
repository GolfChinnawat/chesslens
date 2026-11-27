import { translate } from '../i18n/locale'
import { Chess } from 'chess.js'
import type { UciInfo } from '../engine/uci'
import type { GameReview } from '../types/review'
import { classificationConfig } from './classificationConfig'
import { winPercent } from './classify'

export const puzzleDepth = 16
export const puzzleThemes = {
  mate: translate('รุกฆาต', 'Checkmate'),
  material: translate('ชนะหมาก', 'Win material'),
}

export type PuzzleCandidate = {
  review: GameReview
  ply: number
  fen: string
}
export type Puzzle = PuzzleCandidate & {
  theme: keyof typeof puzzleThemes
  solution: string
  san: string
}

export function puzzleCandidates(reviews: GameReview[], side: string) {
  const seen = new Set<string>()
  const candidates: (PuzzleCandidate & { priority: number })[] = []
  for (const review of [...reviews].sort((a, b) => b.depth - a.depth)) {
    review.positions.forEach(({ move }, ply) => {
      if (!ply || !move || (side !== 'both' && move.color !== side)) return
      const before = review.evaluations[ply - 1].lines[0]
      const after = review.evaluations[ply].score
      if (!before?.moves[0] || !after || before.moves[0].uci === move.uci)
        return
      const missedMate =
        before.score.kind === 'mate' &&
        before.score.winner === move.color &&
        !(after.kind === 'mate' && after.winner === move.color)
      const loss =
        winPercent(before.score, move.color) - winPercent(after, move.color)
      if (!missedMate && loss < 5) return
      const fen = review.positions[ply - 1].fen
      const key = fen.split(' ', 4).join(' ')
      if (seen.has(key)) return
      seen.add(key)
      candidates.push({ review, ply, fen, priority: missedMate ? 101 : loss })
    })
  }
  return candidates.sort((a, b) => b.priority - a.priority).slice(0, 15)
}

export function qualifyPuzzle(
  candidate: PuzzleCandidate,
  result: { bestMove: string | null; lines: UciInfo[] },
): Puzzle | undefined {
  const [best, second] = result.lines
  const solution = best?.pv?.[0]
  const played = candidate.review.positions[candidate.ply].move?.uci
  if (
    !solution ||
    solution === played ||
    solution !== result.bestMove ||
    !best?.score ||
    !second?.score ||
    !second.pv?.[0] ||
    second.pv[0] === solution ||
    (best.depth ?? 0) < puzzleDepth ||
    (second.depth ?? 0) < puzzleDepth
  )
    return

  // UCI scores are relative to the side to move at the root.
  const board = new Chess(candidate.fen)
  if (board.moves().length < 2) return
  const san = board.move(solution).san
  const runnerUp = second.score
  if (runnerUp.kind === 'mate' && runnerUp.value > 0) return
  if (best.score.kind === 'mate') {
    if (best.score.value > 0)
      return { ...candidate, theme: 'mate', solution, san }
    return
  }
  if (
    best.score.value < 100 ||
    (runnerUp.kind === 'cp' && best.score.value - runnerUp.value < 100)
  )
    return

  // Count exchanges along the main line before interpreting a capture as a gain.
  const mover = board.turn() === 'w' ? 'b' : 'w'
  board.undo()
  let gain = 0
  for (const uci of best.pv!.slice(0, 6)) {
    const move = board.move(uci)
    const values = classificationConfig.sacrifice.pieces
    const swing =
      (move.captured ? values[move.captured] : 0) +
      (move.promotion ? values[move.promotion] - values.p : 0)
    gain += move.color === mover ? swing : -swing
  }
  if (gain >= 2) return { ...candidate, theme: 'material', solution, san }
}
