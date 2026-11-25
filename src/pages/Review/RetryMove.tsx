import { createPortal } from 'react-dom'
import { Chess, type Square } from 'chess.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { StockfishEngine } from '../../engine'
import { formatScore } from '../../analysis/score'
import { decodeEvaluation } from '../../analysis/review'
import { buildPositions } from '../../analysis/pgn'
import { classificationText as t } from '../../i18n/classification-th'
import { reviewText } from '../../i18n/review-th'
import type { GameReview, PositionEval } from '../../types/review'

type Props = {
  review: GameReview
  ply: number
  flipped: boolean
  controls: HTMLDivElement | null
  arrows: [Square, Square, string][]
  onTrial: (evaluation: PositionEval | null | undefined) => void
}

export function RetryMove({
  review,
  ply,
  flipped,
  arrows,
  onTrial,
  controls,
}: Props) {
  const before = review.positions[ply - 1].fen
  const game = useMemo(() => new Chess(before), [before])
  const [fen, setFen] = useState(before)
  const [selected, setSelected] = useState<Square>()
  const [promotion, setPromotion] = useState<{ from: Square; to: Square }>()
  const [status, setStatus] = useState('')
  const engine = useRef<StockfishEngine | null>(null)
  const active = useRef<AbortController | null>(null)
  useEffect(() => {
    const worker = new StockfishEngine()
    engine.current = worker
    return () => {
      active.current?.abort()
      worker.destroy()
      engine.current = null
    }
  }, [])

  function tryMove(from: Square, to: Square, promote?: 'q' | 'r' | 'b' | 'n') {
    const legal = game
      .moves({ square: from, verbose: true })
      .filter((move) => move.to === to)
    if (!legal.length) return false
    if (legal[0].promotion && !promote) {
      setPromotion({ from, to })
      return false
    }
    setPromotion(undefined)
    setSelected(undefined)
    const copy = new Chess(before)
    const move = copy.move({ from, to, promotion: promote })
    setFen(copy.fen())
    onTrial(null)
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    const terminal = buildPositions(copy.pgn()).at(-1)?.terminal
    if (terminal) {
      onTrial({ score: terminal, lines: [] })
      setStatus(t.retryScore(move.san, formatScore(terminal)))
      return true
    }
    setStatus(t.evaluation)
    const moves = review.positions
      .slice(1, ply)
      .flatMap(({ move }) => (move ? [move.uci] : []))
    moves.push(move.lan)
    void engine.current
      ?.analyze(review.positions[0].fen, {
        depth: review.depth,
        multiPV: 3,
        moves,
        signal: controller.signal,
      })
      .then((result) => {
        if (controller.signal.aborted) return
        const evaluation = decodeEvaluation(
          copy.fen(),
          copy.turn(),
          result.lines,
        )
        onTrial(evaluation)
        setStatus(
          evaluation.score
            ? t.retryScore(move.san, formatScore(evaluation.score))
            : reviewText.failed,
        )
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus(reviewText.failed)
      })
    return true
  }

  const original = review.evaluations[ply].score
  return (
    <div className="space-y-2">
      <Chessboard
        customLightSquareStyle={{ backgroundColor: 'var(--board-light)' }}
        customDarkSquareStyle={{ backgroundColor: 'var(--board-dark)' }}
        id="retry-board"
        position={fen}
        boardOrientation={flipped ? 'black' : 'white'}
        areArrowsAllowed={false}
        arePiecesDraggable={fen === before}
        showPromotionDialog={false}
        customArrows={arrows}
        onPieceDrop={(from, to) => fen === before && tryMove(from, to)}
        customSquareStyles={
          selected
            ? { [selected]: { boxShadow: 'inset 0 0 0 3px #e6ff8e' } }
            : {}
        }
        onSquareClick={(square) => {
          if (fen !== before) return
          if (selected && selected !== square && tryMove(selected, square))
            return
          setSelected(
            game.get(square)?.color === game.turn() && selected !== square
              ? square
              : undefined,
          )
        }}
      />
      {controls &&
        createPortal(
          <div className="space-y-2">
            <p className="text-sm text-secondary">
              {original && t.original(formatScore(original))}
            </p>
            <p role="status" className="text-sm">
              {status || t.choose}
            </p>
            {promotion && (
              <div
                role="group"
                aria-label={t.promote}
                className="flex flex-wrap gap-2"
              >
                {(['q', 'r', 'b', 'n'] as const).map((piece) => (
                  <button
                    className="control uppercase"
                    key={piece}
                    onClick={() => tryMove(promotion.from, promotion.to, piece)}
                  >
                    {piece}
                  </button>
                ))}
              </div>
            )}
            {fen !== before && (
              <button
                className="control"
                onClick={() => {
                  active.current?.abort()
                  setFen(before)
                  onTrial(undefined)
                  setStatus('')
                }}
              >
                {t.retry}
              </button>
            )}
          </div>,
          controls,
        )}
    </div>
  )
}
