import { expect, it } from 'vitest'
import { accountStats } from '../src/analysis/account-stats'
import { buildPositions } from '../src/analysis/pgn'
import type { GameReview } from '../src/types/review'

it('counts outcomes by the identified side and awards half a point for a draw', () => {
  const pgn = '1. e4 e5 *'
  const positions = buildPositions(pgn)
  const review: GameReview = {
    game: { pgn, headers: { White: 'Alice', Black: 'Bob' } },
    positions,
    depth: 12,
    evaluations: positions.map(() => ({
      score: { kind: 'cp', value: 0 },
      lines: [],
    })),
  }
  const switched = {
    ...review,
    game: { ...review.game, headers: { White: 'Bob', Black: 'Alice' } },
  }
  const result = accountStats(
    [
      { review, result: '1-0', opening: 'King’s Pawn' },
      { review: switched, result: '1/2-1/2', opening: 'King’s Pawn' },
      { review: switched, result: '1-0', opening: null },
    ],
    'alice',
  )
  expect(result.outcomes).toEqual({ w: [1, 0, 0], b: [0, 1, 1] })
  expect(result.openings).toEqual([['King’s Pawn', { games: 2, points: 1.5 }]])
  expect(result.trend.map(({ accuracy }) => accuracy)).toHaveLength(3)
  expect(result.phases.opening).toEqual({ moves: 3, blunders: 0 })
})
