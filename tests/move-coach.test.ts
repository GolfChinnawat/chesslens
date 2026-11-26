import { expect, it } from 'vitest'
import { buildPositions } from '../src/analysis/pgn'
import { explainMove } from '../src/analysis/move-coach'
import type { GameReview } from '../src/types/review'

const grade = {
  kind: 'blunder',
  winBefore: 52,
  winAfter: 0,
  loss: 52,
  accuracy: 0,
} as const
const pgn = '1. f3 e5 2. g4 Qh4# 0-1'
const positions = buildPositions(pgn)
const mate = { kind: 'mate', value: -1, winner: 'b' } as const
const review: GameReview = {
  game: { pgn, headers: {} },
  depth: 12,
  positions,
  evaluations: [
    { lines: [], score: null },
    { lines: [], score: null },
    {
      lines: [
        {
          rank: 1,
          depth: 12,
          score: { kind: 'cp', value: 20 },
          moves: [{ uci: 'g1h3', san: 'Nh3' }],
        },
      ],
      score: { kind: 'cp', value: 20 },
    },
    {
      lines: [
        {
          rank: 1,
          depth: 12,
          score: mate,
          moves: [{ uci: 'd8h4', san: 'Qh4#' }],
        },
      ],
      score: mate,
    },
    { lines: [], score: { kind: 'mate', value: 0, winner: 'b' } },
  ],
}

it('explains a mate threat and recommends the engine move', () => {
  expect(explainMove(review, 3, grade)).toMatchObject({
    reason: 'หลังเดินตานี้ Stockfish พบแนวรุกฆาตให้คู่แข่ง',
    recommendation: 'Stockfish แนะนำ Nh3',
  })
  expect(explainMove(review, 0, grade)).toBeUndefined()
})
