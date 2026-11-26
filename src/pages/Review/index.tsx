import { puzzlesEnabled } from '../Puzzles/feature'
import { useEffect, useRef, useState } from 'react'
import { analyzeGame } from '../../analysis/review'
import { StockfishEngine } from '../../engine'
import { reviewText as t } from '../../i18n/review-th'
import { readReview, reviewKey, saveReview } from '../../store/review-cache'
import type { GameReview, ImportedGame, ReviewDepth } from '../../types/review'
import { Import } from './Import'
import { ReviewBoard } from './ReviewBoard'

export default function ReviewPage() {
  const [review, setReview] = useState<GameReview | null>(readReview)
  const [partial, setPartial] = useState<GameReview | null>(null)
  const [opening, setOpening] = useState(() => !readReview())
  const [progress, setProgress] = useState<{
    done: number
    total: number
    seconds: number
  } | null>(null)
  const [message, setMessage] = useState('')
  const engine = useRef<StockfishEngine | null>(null)
  const active = useRef<AbortController | null>(null)

  useEffect(() => {
    const stockfish = new StockfishEngine()
    engine.current = stockfish
    return () => {
      active.current?.abort()
      stockfish.destroy()
    }
  }, [])

  async function start(
    game: ImportedGame,
    depth: ReviewDepth,
    multiPV: number,
  ) {
    const stockfish = engine.current
    if (!stockfish || active.current) return
    const controller = new AbortController()
    active.current = controller
    setMessage('')
    setProgress({ done: 0, total: 0, seconds: 0 })
    try {
      const key = await reviewKey(game, depth, multiPV)
      controller.signal.throwIfAborted()
      const cached = readReview(key)
      const result =
        cached ??
        (await analyzeGame(
          stockfish,
          game,
          depth,
          controller.signal,
          (done, total, seconds) => {
            setProgress({ done, total, seconds })
          },
          { multiPV, onPartial: setPartial },
        ))
      controller.signal.throwIfAborted()
      const finished = { ...result, game }
      setReview(finished)
      setOpening(false)
      if (!saveReview(key, finished)) setMessage(t.cacheFailed)
    } catch {
      setMessage(controller.signal.aborted ? t.cancelled : t.failed)
    } finally {
      active.current = null
      setProgress(null)
      setPartial(null)
    }
  }

  return (
    <main className="mx-auto max-w-[79rem] px-4 py-4 sm:px-8 sm:py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-raised pb-3">
        <div>
          <p className="text-sm font-semibold tracking-wide text-accent">
            ChessLens
          </p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{t.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!opening && (
            <button
              className="control"
              onClick={() => {
                setOpening(true)
                setMessage('')
              }}
            >
              {t.load}
            </button>
          )}
          {puzzlesEnabled && <a href="?view=puzzles" className="text-sm text-accent">โจทย์หมากรุก</a>}
          {import.meta.env.VITE_SUPABASE_URL && (
            <a href="?view=account" className="text-sm text-accent">
              บัญชีและคลังเกม
            </a>
          )}
          <a
            href="./"
            className="text-sm text-accent underline-offset-4 hover:underline"
          >
            {t.play}
          </a>
        </div>
      </header>
      {opening && !partial && (
        <Import
          busy={!!progress}
          cached={review}
          onRestore={() => {
            setOpening(false)
            setMessage('')
          }}
          onAnalyze={(game, depth, multiPV) => void start(game, depth, multiPV)}
        />
      )}
      {progress && (
        <section className="panel mt-4 max-w-3xl">
          <p role="status">
            {progress.total
              ? t.progress(progress.done, progress.total)
              : t.analyze}
          </p>
          <progress
            aria-label={t.analyze}
            className="mt-2 w-full accent-accent"
            value={progress.total ? progress.done : undefined}
            max={progress.total || 1}
          />
          {progress.seconds > 0 && (
            <p className="mt-1 text-sm text-secondary">
              {t.eta(progress.seconds)}
            </p>
          )}
          <button
            className="control mt-2"
            onClick={() => active.current?.abort()}
          >
            {t.cancel}
          </button>
        </section>
      )}
      {(partial || (!opening && review)) && (
        <div className="mt-4">
          <ReviewBoard
            key={(partial ?? review)?.game.pgn}
            review={(partial ?? review)!}
            analyzing={!!partial}
          />
        </div>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-amber-200">
          {message}
        </p>
      )}
    </main>
  )
}
