import { describe, expect, it } from 'vitest'
import { buildPositions } from '../src/analysis/pgn'
import { puzzleCandidates, qualifyPuzzle } from '../src/analysis/puzzles'
import type { GameReview } from '../src/types/review'

const pgn = '1. f3 e5 2. g4 Nc6 *'
const mate = { kind: 'mate', value: -1, winner: 'b' } as const
const review: GameReview = {
  game: { pgn, headers: {} },
  depth: 12,
  positions: buildPositions(pgn),
  evaluations: [
    { lines: [], score: null },
    { lines: [], score: null },
    { lines: [], score: null },
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
    { lines: [], score: { kind: 'cp', value: -100 } },
  ],
}

describe('puzzle generation', () => {
  it('deduplicates candidate positions and filters by side', () => {
    expect(
      puzzleCandidates([review, review], 'b').map(({ ply }) => ply),
    ).toEqual([4])
    expect(puzzleCandidates([review], 'w')).toEqual([])
  })

  it('requires a full-depth unique winning move before generating a mate puzzle', () => {
    const [candidate] = puzzleCandidates([review], 'both')
    const best = {
      depth: 16,
      score: { kind: 'mate', value: 1 } as const,
      pv: ['d8h4'],
    }
    const other = {
      depth: 16,
      score: { kind: 'cp', value: 50 } as const,
      pv: ['b8c6'],
    }
    expect(
      qualifyPuzzle(candidate, { bestMove: 'd8h4', lines: [best, other] }),
    ).toMatchObject({ theme: 'mate', solution: 'd8h4', san: 'Qh4#' })
    expect(
      qualifyPuzzle(candidate, { bestMove: 'd8h4', lines: [best] }),
    ).toBeUndefined()
    expect(
      qualifyPuzzle(candidate, {
        bestMove: 'd8h4',
        lines: [best, { ...other, depth: 15 }],
      }),
    ).toBeUndefined()
    expect(
      qualifyPuzzle(candidate, {
        bestMove: 'd8h4',
        lines: [best, { ...other, score: { kind: 'mate', value: 3 } }],
      }),
    ).toBeUndefined()
  })
  it('requires a material gain and a clear score gap', () => {
    const pgn =
      '[SetUp "1"]\n[FEN "3r3k/8/8/3r4/8/8/8/3QK3 w - - 0 1"]\n\n1. Kf1 *'
    const positions = buildPositions(pgn)
    const candidate = {
      review: { ...review, positions },
      ply: 1,
      fen: positions[0].fen,
    }
    const best = {
      depth: 16,
      score: { kind: 'cp', value: 200 } as const,
      pv: ['d1d5'],
    }
    const other = {
      depth: 16,
      score: { kind: 'cp', value: 50 } as const,
      pv: ['d1e2'],
    }
    expect(
      qualifyPuzzle(candidate, { bestMove: 'd1d5', lines: [best, other] }),
    ).toMatchObject({ theme: 'material' })
    expect(
      qualifyPuzzle(candidate, {
        bestMove: 'd1d5',
        lines: [{ ...best, pv: ['d1d5', 'd8d5'] }, other],
      }),
    ).toBeUndefined()
    expect(
      qualifyPuzzle(candidate, {
        bestMove: 'd1d5',
        lines: [best, { ...other, score: { kind: 'cp', value: 180 } }],
      }),
    ).toBeUndefined()
  })
})
