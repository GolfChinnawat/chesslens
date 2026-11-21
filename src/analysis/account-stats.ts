import type { Color } from 'chess.js'
import type { GameReview } from '../types/review'
import { classifyReview } from './classify'
import { reviewSummary } from './review-summary'

export function playerSide(review: GameReview, profile = ''): Color | null {
  const name = (review.game.username || profile).trim().toLowerCase()
  if (!name) return null
  const white = review.game.headers.White?.toLowerCase() === name
  const black = review.game.headers.Black?.toLowerCase() === name
  return white === black ? null : white ? 'w' : 'b'
}

export function accountStats(
  games: { review: GameReview; result: string; opening: string | null }[],
  profile: string,
) {
  const outcomes = { w: [0, 0, 0], b: [0, 0, 0] }
  const openingCounts = new Map<string, { games: number; points: number }>()
  const phases = {
    opening: { moves: 0, blunders: 0 },
    middle: { moves: 0, blunders: 0 },
    end: { moves: 0, blunders: 0 },
  }
  const trend = []
  for (const entry of games) {
    const side = playerSide(entry.review, profile)
    if (!side) continue
    const analysis = classifyReview(entry.review)
    const score = side === 'w' ? analysis.white : analysis.black
    trend.push({
      game: trend.length + 1,
      accuracy: score.accuracy,
      rating: score.rating,
    })
    const result = entry.result
    if (['1-0', '0-1', '1/2-1/2'].includes(result)) {
      const win = result === (side === 'w' ? '1-0' : '0-1')
      const draw = result === '1/2-1/2'
      outcomes[side][win ? 0 : draw ? 1 : 2]++
      if (entry.opening) {
        const stats = openingCounts.get(entry.opening) ?? {
          games: 0,
          points: 0,
        }
        stats.games++
        stats.points += win ? 1 : draw ? 0.5 : 0
        openingCounts.set(entry.opening, stats)
      }
    }
    for (const { phase, grade, color } of reviewSummary(
      entry.review,
      analysis.grades,
    ).gradedMoves) {
      if (color !== side) continue
      phases[phase].moves++
      if (grade.kind === 'blunder') phases[phase].blunders++
    }
  }
  return {
    outcomes,
    phases,
    trend,
    openings: [...openingCounts]
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, 5),
  }
}
