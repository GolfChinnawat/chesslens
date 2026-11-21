import { describe, expect, it } from 'vitest'
import { basicClass, moveAccuracy, winPercent } from '../src/analysis/classify'
import { classificationConfig as config } from '../src/analysis/classificationConfig'
import { findOpening } from '../src/analysis/openings'
import { Chess } from 'chess.js'

describe('basic move classification', () => {
  it('maps neutral, winning, losing and mate scores from either side', () => {
    expect(winPercent({ kind: 'cp', value: 0 }, 'w')).toBe(50)
    expect(winPercent({ kind: 'cp', value: 5000 }, 'w')).toBeCloseTo(100)
    expect(winPercent({ kind: 'cp', value: 5000 }, 'b')).toBeCloseTo(0)
    expect(
      winPercent({ kind: 'mate', value: 0, winner: 'b' }, 'b'),
    ).toBeCloseTo(100)
    expect(
      winPercent({ kind: 'mate', value: 0, winner: 'b' }, 'w'),
    ).toBeCloseTo(0)
    expect(moveAccuracy(0)).toBeCloseTo(100)
    expect(moveAccuracy(100)).toBe(0)
  })

  it('includes each configured boundary in its class', () => {
    for (const [kind, limit] of Object.entries(config.loss)) {
      expect(basicClass(limit, false, 50, 50 - limit)).toBe(kind)
    }
    expect(basicClass(config.loss.mistake + 0.01, false, 50, 20)).toBe(
      'blunder',
    )
    expect(basicClass(25, true, 60, 35)).toBe('best')
  })

  it('only labels a squandered advantage created by the last error as Miss', () => {
    expect(basicClass(15, false, 75, 60, 'mistake')).toBe('miss')
    expect(basicClass(15, false, 75, 60, 'good')).toBe('mistake')
    expect(basicClass(15, false, 65, 50, 'blunder')).toBe('mistake')
    expect(basicClass(1, false, 99, 98)).toBe('good')
    expect(basicClass(1, false, 2, 1)).toBe('good')
  })

  it('finds a Sicilian book position by FEN', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('c5')
    expect(findOpening(chess.fen())?.name).toMatch(/Sicilian Defense/)
  })
})

import { classifyReview, onlyGoodMove } from '../src/analysis/classify'
import { isSacrifice } from '../src/analysis/sacrifice'
import { buildPositions } from '../src/analysis/pgn'
import type { GameReview } from '../src/types/review'

describe('tactical grades', () => {
  it('identifies an only-good move by gap or a result bracket', () => {
    expect(onlyGoodMove(60, 50)).toBe(true)
    expect(onlyGoodMove(35, 34)).toBe(true)
    expect(onlyGoodMove(66, 64)).toBe(true)
    expect(onlyGoodMove(58, 50)).toBe(false)
  })

  it('sees the bishop sacrifice on h7 and the queen loss in the Legal Trap', () => {
    const bishop = new Chess('6k1/7p/8/8/8/3B1N2/8/4K3 w - - 0 1')
    expect(
      isSacrifice(bishop.fen(), 'd3h7', ['d3h7', 'g8h7', 'f3g5', 'h7g8']),
    ).toBe(true)
    const queen = new Chess()
    queen.loadPgn('1. e4 e5 2. Nf3 Nc6 3. Bc4 d6 4. Nc3 Bg4 5. h3 Bh5 *')
    expect(
      isSacrifice(queen.fen(), 'f3e5', ['f3e5', 'h5d1', 'c4f7', 'e8e7']),
    ).toBe(true)
  })

  it('rejects an equal trade, pawn-only loss, and invalid continuation', () => {
    const board = new Chess('7k/8/1p6/2b5/3N4/8/8/4K3 w - - 0 1')
    expect(isSacrifice(board.fen(), 'd4c6', ['d4c6', 'b6c5'])).toBe(false)
    const trade = new Chess('7k/8/8/1p6/2b5/1B6/8/4K3 w - - 0 1')
    expect(isSacrifice(trade.fen(), 'b3c4', ['b3c4', 'b5c4'])).toBe(false)
    const pawns = new Chess('7k/8/8/3p4/8/4P3/8/4K3 w - - 0 1')
    expect(isSacrifice(pawns.fen(), 'e3e4', ['e3e4', 'd5e4'])).toBe(false)
  })

  it('grades a complete fixture with stable per-side counts and preserves terminal mate', () => {
    const game = new Chess(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 2',
    )
    for (const move of ['f3', 'e5', 'g4', 'Qh4#']) game.move(move)
    const pgn = game.pgn()
    const positions = buildPositions(pgn)
    const scores = [30, -125, -125, -5000]
    const best = ['e2e4', 'e7e5', 'e2e4', 'd8h4']
    const evaluations = positions.map((position, index) => {
      if (position.terminal) return { score: position.terminal, lines: [] }
      const score = { kind: 'cp' as const, value: scores[index] }
      const game = new Chess(position.fen)
      const move = game.move(best[index])
      return {
        score,
        lines: [
          {
            rank: 1,
            depth: 16,
            score,
            moves: [{ san: move.san, uci: move.lan }],
          },
        ],
      }
    })
    const review: GameReview = {
      game: { pgn, headers: {} },
      depth: 16,
      positions,
      evaluations,
    }
    const result = classifyReview(review)
    expect(result.grades.slice(1).map((grade) => grade?.kind)).toEqual([
      'mistake',
      'best',
      'blunder',
      'best',
    ])
    expect(result.black.counts.get('best')).toBe(2)
    expect(result.black.accuracy).toBeCloseTo(100)
  })
})
