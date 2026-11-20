import { useEffect, useRef, useState } from 'react'
import type { Chess } from 'chess.js'
import { StockfishEngine } from '../../engine'
import { getBotLevel, type BotLevel } from '../../engine/bot-levels'
import { initialFen, moveUci } from '../../lib/game'
import { useGameStore } from '../../store'

type Job = { game: Chess; controller: AbortController }
type Notice = { game: Chess; kind: 'engineError' | 'declined' }

// Half a pawn is the maximum imbalance the bot accepts as a draw.
const drawThresholdCp = 50

export function useBot(
  game: Chess,
  level: BotLevel,
  botTurn: boolean,
  finished: boolean,
) {
  const engine = useRef<StockfishEngine | null>(null)
  const draw = useRef<Job | null>(null)
  const [drawGame, setDrawGame] = useState<Chess | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const stockfish = new StockfishEngine()
    engine.current = stockfish
    return () => {
      draw.current?.controller.abort()
      stockfish.destroy()
      engine.current = null
    }
  }, [])

  useEffect(() => {
    if (!botTurn) return
    const stockfish = engine.current
    if (!stockfish) return
    const controller = new AbortController()

    async function reply(stockfish: StockfishEngine) {
      const { skill, depth, movetime } = getBotLevel(level)
      await stockfish.setOption('Skill Level', skill)
      controller.signal.throwIfAborted()
      const moves = game.history({ verbose: true })
      const { bestMove } = await stockfish.analyze(initialFen(moves, game), {
        depth,
        movetime,
        moves: moves.map(moveUci),
        signal: controller.signal,
        cache: false,
      })
      if (controller.signal.aborted) return
      if (!bestMove || !useGameStore.getState().play(bestMove, game, 'bot')) {
        throw new Error('Stockfish returned no playable move')
      }
    }

    void reply(stockfish).catch(() => {
      if (!controller.signal.aborted) setNotice({ game, kind: 'engineError' })
    })
    return () => controller.abort()
  }, [game, level, botTurn, retry])

  useEffect(
    () => () => {
      const job = draw.current
      if (job?.game === game) {
        job.controller.abort()
        draw.current = null
      }
    },
    [game, finished],
  )

  async function offerDraw() {
    const stockfish = engine.current
    if (!stockfish || draw.current) return
    const controller = new AbortController()
    const job = { game, controller }
    draw.current = job
    setDrawGame(game)
    setNotice(null)
    try {
      await stockfish.setOption('Skill Level', 20)
      controller.signal.throwIfAborted()
      const { lines } = await stockfish.analyze(game.fen(), {
        depth: 12,
        movetime: 500,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      const score = lines[0]?.score
      if (score?.kind === 'cp' && Math.abs(score.value) <= drawThresholdCp) {
        useGameStore.getState().end('agreed', game)
      } else {
        setNotice({ game, kind: 'declined' })
      }
    } catch {
      if (!controller.signal.aborted) setNotice({ game, kind: 'engineError' })
    } finally {
      if (draw.current === job) {
        draw.current = null
        setDrawGame(null)
      }
    }
  }

  function reset() {
    draw.current?.controller.abort()
    draw.current = null
    setDrawGame(null)
    setNotice(null)
    void engine.current?.newGame().catch(() => undefined)
  }

  return {
    offering: !finished && drawGame === game,
    notice: notice?.game === game ? notice.kind : null,
    offerDraw,
    reset,
    retry: () => {
      setNotice(null)
      setRetry((value) => value + 1)
    },
  }
}
