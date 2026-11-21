import { Chess } from 'chess.js'
import type { GameReview } from '../types/review'
import type { MoveGrade } from './classify'

export function reviewSummary(
  review: GameReview,
  grades: (MoveGrade | undefined)[],
) {
  const phases = {
    opening: { w: [] as number[], b: [] as number[] },
    middle: { w: [] as number[], b: [] as number[] },
    end: { w: [] as number[], b: [] as number[] },
  }
  const gradedMoves: {
    phase: keyof typeof phases
    grade: MoveGrade
    color: 'w' | 'b'
  }[] = []
  let endgame = false
  const swings = grades
    .flatMap((grade, ply) => {
      const move = review.positions[ply]?.move
      if (!grade || !move) return []
      const position = new Chess(review.positions[ply - 1].fen)
      const pieces = position
        .board()
        .flat()
        .filter((piece) => piece && piece.type !== 'p' && piece.type !== 'k')
      endgame ||= pieces.length <= 6
      const phase = endgame ? 'end' : ply <= 20 ? 'opening' : 'middle'
      if (grade.accuracy !== null) {
        phases[phase][move.color].push(grade.accuracy)
        gradedMoves.push({ phase, grade, color: move.color })
      }
      return grade.loss > 0 ? [{ ply, move, swing: grade.loss }] : []
    })
    .sort((a, b) => b.swing - a.swing)
    .slice(0, 3)
  return { phases, swings, gradedMoves }
}
