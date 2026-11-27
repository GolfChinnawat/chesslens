import type { Chess, Move } from 'chess.js'
import { useEffect, useRef, useState } from 'react'
import { StockfishEngine } from '../../engine'

export function useHint(game: Chess, fen: string, enabled: boolean) {
  const engine = useRef<StockfishEngine | null>(null)
  const active = useRef<AbortController | null>(null)
  const [result, setResult] = useState<{
    game: Chess
    fen: string
    state: 'thinking' | 'error' | Move
  }>()
  const current =
    enabled && result?.game === game && result.fen === fen
      ? result.state
      : undefined

  useEffect(
    () => () => {
      engine.current?.destroy()
      engine.current = null
    },
    [],
  )

  useEffect(() => {
    setResult(undefined)
    return () => {
      active.current?.abort()
      active.current = null
    }
  }, [game, fen, enabled])

  async function request() {
    if (!enabled || active.current || typeof current === 'object') return
    const controller = new AbortController()
    active.current = controller
    const stockfish = (engine.current ??= new StockfishEngine())
    setResult({ game, fen, state: 'thinking' })
    const timeout = window.setTimeout(() => {
      if (active.current === controller) {
        stockfish.destroy()
        engine.current = null
      }
    }, 2500)

    try {
      const { bestMove } = await stockfish.analyze(fen, {
        movetime: 450,
        signal: controller.signal,
      })
      if (!bestMove) throw new Error('No hint available')
      const move = game
        .moves({ verbose: true })
        .find((candidate) => candidate.lan === bestMove)
      if (!move) throw new Error('Invalid hint')
      if (!controller.signal.aborted) setResult({ game, fen, state: move })
    } catch {
      if (!controller.signal.aborted) setResult({ game, fen, state: 'error' })
    } finally {
      window.clearTimeout(timeout)
      if (active.current === controller) active.current = null
    }
  }

  return { current, request }
}
