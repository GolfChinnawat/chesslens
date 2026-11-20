import { Chess, DEFAULT_POSITION } from 'chess.js'
import { expect, it, vi } from 'vitest'
import { buildPositions, importGames } from '../src/analysis/pgn'
import { analyzeGame } from '../src/analysis/review'
import {
  evaluationScale,
  formatScore,
  normalizeScore,
  scoreForMover,
} from '../src/analysis/score'

it('splits PGN games without splitting annotations and reads headers', () => {
  const games = importGames(`[White "Alice"]
[Black "Bob"]
[Date "2026.11.21"]
[ECO "C20"]

1. e4 {Text with 1-0 or [result]} (1. d4 d5) e5 *

[White "Carol"]
[Black "Dan"]

1. d4 d5 *`)
  expect(games.map((game) => game.headers.White)).toEqual(['Alice', 'Carol'])
  expect(games[0].headers).toMatchObject({
    Black: 'Bob',
    Date: '2026.11.21',
    ECO: 'C20',
    Result: '*',
  })
  expect(importGames('1. e4 e5 *\n1. d4 d5 *')).toHaveLength(2)
  expect(() => importGames('1. e9')).toThrow()
  expect(() => importGames('')).toThrow()
})

it('builds the start, move FENs, and terminal checkmate from PGN', () => {
  const game = new Chess()
  for (const move of ['f3', 'e5', 'g4', 'Qh4#']) game.move(move)
  const positions = buildPositions(game.pgn())
  expect(positions).toHaveLength(5)
  expect(positions[0]).toMatchObject({ fen: DEFAULT_POSITION, turn: 'w' })
  expect(positions[1].move).toEqual({
    number: 1,
    color: 'w',
    uci: 'f2f3',
    san: 'f3',
  })
  expect(positions.at(-1)).toMatchObject({
    fen: game.fen(),
    terminal: { kind: 'mate', value: 0, winner: 'b' },
  })
})

it('uses the FEN and move number from a PGN setup position and scores stalemate', () => {
  const game = new Chess('7k/4Q3/6K1/8/8/8/8/8 w - - 0 43')
  game.move('Qf7')
  const [initial, final] = buildPositions(game.pgn())
  expect(initial.fen).toMatch(/0 43$/)
  expect(final.move?.number).toBe(43)
  expect(game.isStalemate()).toBe(true)
  expect(final.terminal).toEqual({ kind: 'cp', value: 0 })
})

it('normalizes centipawn and mate scores and preserves a terminal mate winner', () => {
  const score = normalizeScore({ kind: 'cp', value: 143 }, 'b')
  expect(score.value).toBe(-143)
  expect(scoreForMover(score, 'b').value).toBe(143)
  expect(formatScore(score)).toBe('-1.4')
  expect(evaluationScale(score)).toBeLessThan(0)
  const mate = normalizeScore({ kind: 'mate', value: -3 }, 'b')
  expect(formatScore(mate)).toBe('M3')
  expect(evaluationScale(mate)).toBe(100)
  expect(evaluationScale({ kind: 'mate', value: 0, winner: 'b' })).toBe(-100)
})

it('decodes SAN lines, reports progress, and avoids searching terminal positions', async () => {
  const game = importGames(
    '[SetUp "1"]\n[FEN "7k/8/5KQ1/8/8/8/8/8 w - - 0 1"]\n\n1. Qg7# 1-0',
  )[0]
  const analyze = vi.fn(async () => ({
    bestMove: 'g6g7',
    ponder: null,
    lines: [
      {
        depth: 12,
        multipv: 1,
        score: { kind: 'mate' as const, value: 1 },
        pv: ['g6g7'],
      },
    ],
  }))
  const progress = vi.fn()
  const review = await analyzeGame(
    { analyze },
    game,
    12,
    new AbortController().signal,
    progress,
  )
  expect(analyze).toHaveBeenCalledTimes(1)
  expect(review.evaluations[0].lines[0].moves).toEqual([
    { san: 'Qg7#', uci: 'g6g7' },
  ])
  expect(review.evaluations[1].score).toEqual({
    kind: 'mate',
    value: 0,
    winner: 'w',
  })
  expect(progress).toHaveBeenLastCalledWith(2, 2, 0)
})

it('cancels the sequence before the next position', async () => {
  const game = importGames('1. e4 e5 *')[0]
  const controller = new AbortController()
  const analyze = vi.fn(async () => {
    controller.abort()
    return { bestMove: null, ponder: null, lines: [] }
  })
  await expect(
    analyzeGame({ analyze }, game, 12, controller.signal, vi.fn()),
  ).rejects.toMatchObject({ name: 'AbortError' })
  expect(analyze).toHaveBeenCalledTimes(1)
})
