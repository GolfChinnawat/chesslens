import { AppInstallation } from '../../pwa/AppInstallation'
import { puzzlesEnabled } from '../Puzzles/feature'
import { openingTrainerEnabled } from '../Opening/feature'
import { useState } from 'react'
import type { Color, Move, PieceSymbol } from 'chess.js'
import { PlayBoard } from '../../components/play-board'
import { botLevels, isBotLevel } from '../../engine/bot-levels'
import { playMessages as text } from '../../i18n'
import {
  gamePgn,
  initialFen,
  opponent,
  summarizeMaterial,
} from '../../lib/game'
import { useGameStore } from '../../store'
import type { ColorChoice } from '../../store/game-store'
import { useBot } from './use-bot'

const colorLabel = (color: Color) => (color === 'w' ? text.white : text.black)
const glyphs: Record<Color, Record<PieceSymbol, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
}

function moveRows(history: Move[]) {
  const rows = new Map<number, { w?: Move; b?: Move }>()
  for (const move of history) {
    const number = Number(move.before.split(' ')[5])
    const row = rows.get(number) ?? {}
    row[move.color] = move
    rows.set(number, row)
  }
  return [...rows]
}

export function PlayPage() {
  const state = useGameStore()
  const { game, history, ply, orientation, player, outcome } = state
  const [choice, setChoice] = useState(state.choice)
  const [level, setLevel] = useState(state.level)
  const [feedback, setFeedback] = useState<{
    game: typeof game
    message: string
  } | null>(null)
  const botTurn = !outcome && game.turn() !== player
  const bot = useBot(game, state.level, botTurn, !!outcome)
  const lastMove = history[ply - 1]
  const fen = lastMove?.after ?? initialFen(history, game)
  const { captures, balance } = summarizeMaterial(history.slice(0, ply), fen)
  const live = ply === history.length
  const canMove = !outcome && !botTurn && !bot.offering && live
  const status = outcome
    ? outcome.winner
      ? text.winner(colorLabel(outcome.winner), text.reasons[outcome.reason])
      : text.drawResult(text.reasons[outcome.reason])
    : bot.offering
      ? text.evaluating
      : botTurn
        ? bot.notice === 'engineError'
          ? text.engineError
          : text.thinking
        : text.yourTurn

  function start() {
    if (!outcome && history.length && !window.confirm(text.confirmNew)) return
    bot.reset()
    state.start(choice, level)
  }

  function playerLabel(color: Color) {
    return color === player
      ? text.player
      : `${text.bot} · ${text.level} ${state.level}`
  }

  async function copyPgn() {
    try {
      await navigator.clipboard.writeText(gamePgn(game, player, outcome))
      setFeedback({ game, message: text.copied })
    } catch {
      setFeedback({ game, message: text.copyFailed })
    }
  }

  function downloadPgn() {
    const blob = new Blob([gamePgn(game, player, outcome)], {
      type: 'application/x-chess-pgn',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'chesslens-game.pgn'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }

  return (
    <main className="play-layout mx-auto max-w-6xl px-4 py-4 sm:px-8 sm:py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-raised pb-3">
        <div>
          <p className="text-sm font-semibold tracking-wide text-accent">
            ChessLens
          </p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
            {text.title}
          </h1>
        </div>
        <nav className="flex flex-wrap gap-3">
          {openingTrainerEnabled && (
            <a
              href="?view=opening"
              className="text-sm text-accent underline-offset-4 hover:underline"
            >
              ฝึกเปิดเกม
            </a>
          )}
          <a
            href="?view=review"
            className="text-sm text-accent underline-offset-4 hover:underline"
          >
            {text.review}
          </a>
          <a
            href="?view=smoke"
            className="text-sm text-accent underline-offset-4 hover:underline"
          >
            {text.smoke}
          </a>
          {puzzlesEnabled && <a href="?view=puzzles" className="text-sm text-accent">โจทย์หมากรุก</a>}
        </nav>
      </header>
      <div className="play-columns grid gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="play-board-column min-w-0">
          <p className="mb-2 text-sm text-secondary">
            {colorLabel(opponent(orientation))} ·{' '}
            {playerLabel(opponent(orientation))}
          </p>
          <div className="play-board-slot">
            <div className="play-board-frame">
              <PlayBoard
                game={game}
                fen={fen}
                lastMove={lastMove}
                orientation={orientation}
                canMove={canMove}
                play={(move) => state.play(move, game, 'player')}
              />
            </div>
          </div>
          <p className="mt-2 text-sm text-secondary">
            {colorLabel(orientation)} · {playerLabel(orientation)}
          </p>
        </div>
        <aside className="play-sidebar min-w-0 space-y-4">
          {import.meta.env.PROD && <AppInstallation />}
          <section className="panel">
            <p role="status" className="font-semibold text-accent">
              {status}
            </p>
            {bot.notice &&
              !(botTurn && bot.notice === 'engineError') &&
              !outcome && (
                <p className="mt-2 text-sm text-amber-200">
                  {text[bot.notice]}
                </p>
              )}
            {botTurn && bot.notice === 'engineError' && (
              <button className="control mt-2" onClick={bot.retry}>
                {text.retry}
              </button>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="text-sm text-secondary">
                {text.color}
                <select
                  className="control mt-1 w-full"
                  value={choice}
                  onChange={(event) =>
                    setChoice(event.target.value as ColorChoice)
                  }
                >
                  {(['white', 'black', 'random'] as const).map((color) => (
                    <option key={color} value={color}>
                      {text[color]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-secondary">
                {text.level}
                <select
                  className="control mt-1 w-full"
                  value={level}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (isBotLevel(value)) setLevel(value)
                  }}
                >
                  {botLevels.map(({ level }) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="control mt-2 w-full primary-control"
              onClick={start}
            >
              {text.newGame}
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                className="control"
                disabled={!history.some((move) => move.color === player)}
                onClick={state.undo}
              >
                {text.undo}
              </button>
              <button className="control" onClick={state.flip}>
                {text.flip}
              </button>
              <button
                className="control"
                disabled={!!outcome}
                onClick={() => {
                  if (window.confirm(text.confirmResign))
                    state.end('resigned', game)
                }}
              >
                {text.resign}
              </button>
              <button
                className="control"
                disabled={!canMove}
                onClick={() => void bot.offerDraw()}
              >
                {text.draw}
              </button>
            </div>
          </section>
          <section className="panel">
            <h2 className="font-semibold">{text.moves}</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{text.emptyMoves}</p>
            ) : (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="control"
                    disabled={ply === 0}
                    onClick={() => state.goTo(0)}
                  >
                    {text.start}
                  </button>
                  <button
                    className="control"
                    disabled={live}
                    onClick={() => state.goTo(history.length)}
                  >
                    {text.live}
                  </button>
                </div>
                {!live && (
                  <p className="mt-2 text-sm text-amber-200">{text.watching}</p>
                )}
                <div className="mt-3 max-h-48 overflow-auto">
                  <table className="w-full table-fixed text-left text-sm">
                    <thead className="text-secondary">
                      <tr>
                        <td className="w-9" />
                        <th scope="col">{text.white}</th>
                        <th scope="col">{text.black}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moveRows(history).map(([number, row]) => (
                        <tr key={number} className="odd:bg-raised/60">
                          <th
                            scope="row"
                            className="pl-2 font-normal text-muted"
                          >
                            {number}.
                          </th>
                          {(['w', 'b'] as const).map((color) => {
                            const move = row[color]
                            return (
                              <td key={color}>
                                {move && (
                                  <button
                                    className="w-full rounded px-2 py-2 text-left font-mono aria-current:bg-accent aria-current:text-canvas"
                                    aria-current={move === lastMove}
                                    onClick={() =>
                                      state.goTo(history.indexOf(move) + 1)
                                    }
                                  >
                                    {move.san}
                                  </button>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <h3 className="mt-4 border-t border-line pt-3 text-sm font-semibold">
              {text.captured}
            </h3>
            {(['w', 'b'] as const).map((color) => (
              <p key={color} className="mt-1 text-sm text-secondary">
                {colorLabel(color)}{' '}
                <span className="ml-1 text-base text-foreground">
                  {captures[color]
                    .map((piece) => glyphs[opponent(color)][piece])
                    .join(' ') || text.none}
                </span>
              </p>
            ))}
            <p className="mt-1 text-sm text-secondary">
              {balance
                ? text.ahead(
                    colorLabel(balance > 0 ? 'w' : 'b'),
                    Math.abs(balance),
                  )
                : text.equal}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="control" onClick={() => void copyPgn()}>
                {text.copy}
              </button>
              <button className="control" onClick={downloadPgn}>
                {text.download}
              </button>
            </div>
            {feedback?.game === game && (
              <p role="status" className="mt-2 text-sm text-accent">
                {feedback.message}
              </p>
            )}
          </section>
          <footer className="border-t border-line pt-3">
            <a
              href="https://github.com/GolfChinnawat/chesslens/issues/new?template=bug_report.yml"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent underline-offset-4 hover:underline"
            >
              แจ้งบั๊กบน GitHub
            </a>
          </footer>
        </aside>
      </div>
    </main>
  )
}
