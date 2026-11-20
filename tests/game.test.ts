import { Chess } from 'chess.js'
import { expect, it } from 'vitest'
import { gamePgn, getOutcome, summarizeMaterial } from '../src/lib/game'
import { useGameStore } from '../src/store'

it('enforces moves, ignores stale bot replies, and undoes a complete turn', () => {
  const store = useGameStore.getState()
  store.start('white', 4)
  const game = useGameStore.getState().game
  expect(store.play('e2e5', game, 'player')).toBe(false)
  expect(store.play('e2e4', game, 'player')).toBe(true)
  expect(store.play('e7e5', game, 'bot')).toBe(false)
  expect(store.play('e7e5', useGameStore.getState().game, 'bot')).toBe(true)
  store.undo()
  expect(useGameStore.getState().game.fen()).toBe(game.fen())
})

it('keeps the opening bot move when undoing a turn as Black', () => {
  const store = useGameStore.getState()
  store.start('black', 4)
  expect(store.play('e2e4', useGameStore.getState().game, 'bot')).toBe(true)
  expect(store.play('e7e5', useGameStore.getState().game, 'player')).toBe(true)
  store.undo()
  expect(useGameStore.getState().history.map(({ san }) => san)).toEqual(['e4'])
})

it('recognizes checkmate and exports a PGN with the matching result', () => {
  const game = new Chess()
  for (const move of ['f3', 'e5', 'g4', 'Qh4#']) game.move(move)
  const outcome = getOutcome(game, 'w', null)
  expect(outcome).toEqual({ winner: 'b', reason: 'mate' })
  const restored = new Chess()
  restored.loadPgn(gamePgn(game, 'w', outcome))
  expect(restored.getHeaders().Result).toBe('0-1')
  expect(restored.fen()).toBe(game.fen())
})

it('detects threefold, the fifty-move rule, stalemate, and insufficient material', () => {
  const game = new Chess()
  for (let i = 0; i < 2; i++) {
    for (const move of ['Nf3', 'Nf6', 'Ng1', 'Ng8']) game.move(move)
  }
  expect(getOutcome(game, 'w', null)?.reason).toBe('repetition')
  expect(
    getOutcome(new Chess('7k/8/8/8/8/8/R7/K7 w - - 100 51'), 'w', null)?.reason,
  ).toBe('fifty')
  expect(
    getOutcome(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), 'w', null)?.reason,
  ).toBe('stalemate')
  expect(
    getOutcome(new Chess('7k/8/8/8/8/8/8/K7 w - - 0 1'), 'w', null)?.reason,
  ).toBe('material')
})

it('tracks en passant and material after underpromotion', () => {
  const enPassant = new Chess()
  for (const move of ['e4', 'a6', 'e5', 'd5', 'exd6']) enPassant.move(move)
  expect(
    summarizeMaterial(enPassant.history({ verbose: true }), enPassant.fen()),
  ).toEqual({
    captures: { w: ['p'], b: [] },
    balance: 1,
  })
  const promotion = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1')
  const move = promotion.move('a7a8r')
  expect(summarizeMaterial([move], promotion.fen()).balance).toBe(5)
})
