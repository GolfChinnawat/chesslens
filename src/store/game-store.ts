import {
  Chess,
  type Color,
  type Square,
  type Move,
  type PieceSymbol,
} from 'chess.js'
import { create } from 'zustand'
import { getOutcome, type ManualEnd, type Outcome } from '../lib/game'
import { isBotLevel, type BotLevel } from '../engine/bot-levels'

export type ColorChoice = 'white' | 'black' | 'random'
type MoveInput = { from: Square; to: Square; promotion?: PieceSymbol }
type GameState = {
  game: Chess
  history: Move[]
  ply: number
  orientation: Color
  player: Color
  choice: ColorChoice
  level: BotLevel
  manualEnd: ManualEnd
  outcome: Outcome | null
}
type Actions = {
  start: (choice: ColorChoice, level: BotLevel) => void
  play: (
    move: MoveInput | string,
    expectedGame: Chess,
    actor: 'player' | 'bot',
  ) => boolean
  undo: () => void
  end: (reason: Exclude<ManualEnd, null>, expectedGame: Chess) => void
  flip: () => void
  goTo: (ply: number) => void
}

const storageKey = 'chesslens.play.v1'

function gameState(game: Chess, player: Color, manualEnd: ManualEnd) {
  const history = game.history({ verbose: true })
  return {
    game,
    history,
    ply: history.length,
    manualEnd,
    outcome: getOutcome(game, player, manualEnd),
  }
}

function createGame(choice: ColorChoice, level: BotLevel): GameState {
  const player =
    choice === 'white' || (choice === 'random' && Math.random() < 0.5)
      ? 'w'
      : 'b'
  return {
    ...gameState(new Chess(), player, null),
    player,
    orientation: player,
    choice,
    level,
  }
}

function restore(): GameState {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (!saved || typeof saved.pgn !== 'string' || !isBotLevel(saved.level))
      return createGame('white', 4)
    const { player, orientation, choice, manualEnd, level } = saved
    if (
      (player !== 'w' && player !== 'b') ||
      (orientation !== 'w' && orientation !== 'b') ||
      !['white', 'black', 'random'].includes(choice) ||
      ![null, 'resigned', 'agreed'].includes(manualEnd)
    ) {
      return createGame('white', 4)
    }
    const game = new Chess()
    game.loadPgn(saved.pgn)
    return {
      ...gameState(game, player, manualEnd),
      player,
      orientation,
      choice,
      level,
    }
  } catch {
    return createGame('white', 4)
  }
}

function cloneGame(game: Chess) {
  const copy = new Chess()
  copy.loadPgn(game.pgn())
  return copy
}

export const useGameStore = create<GameState & Actions>((set, get) => ({
  ...restore(),
  start: (choice, level) => set(createGame(choice, level)),
  play: (move, expectedGame, actor) => {
    const state = get()
    const playerTurn = state.game.turn() === state.player
    if (
      state.outcome ||
      state.game !== expectedGame ||
      playerTurn !== (actor === 'player') ||
      (actor === 'player' && state.ply !== state.history.length)
    )
      return false
    const game = cloneGame(state.game)
    try {
      game.move(move)
    } catch {
      return false
    }
    set(gameState(game, state.player, null))
    return true
  },
  undo: () => {
    const { game, history, player } = get()
    if (!history.some((move) => move.color === player)) return
    const copy = cloneGame(game)
    // Drop the player's last move and any response made since it.
    while (copy.undo()?.color !== player) {
      // A player move is guaranteed by the history check.
    }
    set(gameState(copy, player, null))
  },
  end: (reason, expectedGame) => {
    const { game, outcome, player } = get()
    if (game === expectedGame && !outcome)
      set({ manualEnd: reason, outcome: getOutcome(game, player, reason) })
  },
  flip: () =>
    set(({ orientation }) => ({
      orientation: orientation === 'w' ? 'b' : 'w',
    })),
  goTo: (ply) => {
    const { history } = get()
    if (Number.isInteger(ply) && ply >= 0 && ply <= history.length) set({ ply })
  },
}))

useGameStore.subscribe((state, previous) => {
  if (
    state.game === previous.game &&
    state.orientation === previous.orientation &&
    state.manualEnd === previous.manualEnd &&
    state.level === previous.level
  )
    return
  const { game, player, orientation, choice, level, manualEnd } = state
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        pgn: game.pgn(),
        player,
        orientation,
        choice,
        level,
        manualEnd,
      }),
    )
  } catch {
    // Play remains available when browser storage is disabled or full.
  }
})
