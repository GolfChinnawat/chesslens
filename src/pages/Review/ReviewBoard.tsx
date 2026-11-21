import { useEffect, useMemo, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { Square } from 'chess.js'
import {
  Area,
  AreaChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { evaluationScale, formatScore } from '../../analysis/score'
import { reviewText as t } from '../../i18n/review-th'
import type { GameReview, ReviewScore } from '../../types/review'

import { classifyReview, missedClasses } from '../../analysis/classify'
import { classificationText as labels } from '../../i18n/classification-th'
import { GradeIcon, GradeSummary } from './MoveGrade'
import { RetryMove } from './RetryMove'

const colors = ['#a3e635', '#38bdf8', '#fb923c']

export function ReviewBoard({ review }: { review: GameReview }) {
  const [ply, setPly] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [more, setMore] = useState(false)
  const [retryPly, setRetryPly] = useState<number>()
  const [showBest, setShowBest] = useState(false)
  const classification = useMemo(() => classifyReview(review), [review])
  const grade = classification.grades[ply]
  const missed = !!grade && missedClasses.has(grade.kind)
  const retrying = missed && retryPly === ply
  const nextMiss = classification.grades.findIndex(
    (item, index) => index > ply && item && missedClasses.has(item.kind),
  )
  const last = review.positions.length - 1
  const current = review.positions[ply]
  const evaluation = review.evaluations[ply]

  useEffect(() => {
    function navigate(event: KeyboardEvent) {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !(event.target instanceof HTMLElement) ||
        event.target.closest('input, textarea, select, [contenteditable]')
      )
        return
      switch (event.key) {
        case 'ArrowLeft':
          setPly((value) => Math.max(0, value - 1))
          break
        case 'ArrowRight':
          setPly((value) => Math.min(last, value + 1))
          break
        case 'Home':
          setPly(0)
          break
        case 'End':
          setPly(last)
          break
        default:
          return
      }
      event.preventDefault()
    }
    window.addEventListener('keydown', navigate)
    return () => window.removeEventListener('keydown', navigate)
  }, [last])

  const arrows = evaluation.lines
    .slice(0, more ? 3 : 1)
    .flatMap((line, index): [Square, Square, string][] => {
      const move = line.moves[0]?.uci
      return move
        ? [
            [
              move.slice(0, 2) as Square,
              move.slice(2, 4) as Square,
              colors[index],
            ],
          ]
        : []
    })
  const move = current.move?.uci
  const target = move?.slice(2, 4)
  const file = target ? target.charCodeAt(0) - 97 : 0
  const rank = target ? Number(target[1]) - 1 : 0
  const badgePosition = {
    left: `${(flipped ? 7 - file : file) * 12.5 + 12.5}%`,
    top: `${(flipped ? rank : 7 - rank) * 12.5}%`,
  }
  const shade = { boxShadow: 'inset 0 0 0 100px #b9df4966' }
  const chart = review.evaluations.map(({ score }, index) => ({
    ply: index,
    score: evaluationScale(score),
    label: score ? formatScore(score) : '—',
  }))
  const { White, Black, Result, Date, ECO } = review.game.headers

  return (
    <article className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">
          {t.players(White ?? t.unknown, Black ?? t.unknown)}
        </h2>
        <p className="text-sm text-slate-300">
          {[
            Result,
            Date,
            classification.opening
              ? `${classification.opening.eco} · ${classification.opening.name}`
              : ECO,
            `${t.depth} ${review.depth}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>
      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2">
            <EvalBar
              score={
                retrying ? review.evaluations[ply - 1].score : evaluation.score
              }
              flipped={flipped}
            />
            <section
              aria-label={t.board}
              className="relative min-w-0 overflow-hidden rounded-lg border border-slate-700"
            >
              {retrying ? (
                <RetryMove
                  key={ply}
                  review={review}
                  ply={ply}
                  flipped={flipped}
                  showBest={showBest}
                />
              ) : (
                <>
                  <Chessboard
                    id="review-board"
                    position={current.fen}
                    boardOrientation={flipped ? 'black' : 'white'}
                    areArrowsAllowed={false}
                    arePiecesDraggable={false}
                    customArrows={arrows}
                    customLightSquareStyle={{ backgroundColor: '#dce8d8' }}
                    customDarkSquareStyle={{ backgroundColor: '#56817b' }}
                    customSquareStyles={
                      move
                        ? {
                            [move.slice(0, 2)]: shade,
                            [move.slice(2, 4)]: shade,
                          }
                        : {}
                    }
                  />
                  {grade && target && (
                    <div
                      className="pointer-events-none absolute z-20 -translate-x-full p-0.5"
                      style={badgePosition}
                    >
                      <GradeIcon kind={grade.kind} />
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="control"
              aria-label={t.first}
              disabled={ply === 0}
              onClick={() => setPly(0)}
            >
              ⏮
            </button>
            <button
              className="control"
              aria-label={t.previous}
              disabled={ply === 0}
              onClick={() => setPly(ply - 1)}
            >
              ◀
            </button>
            <button
              className="control"
              aria-label={t.next}
              disabled={ply === last}
              onClick={() => setPly(ply + 1)}
            >
              ▶
            </button>
            <button
              className="control"
              aria-label={t.last}
              disabled={ply === last}
              onClick={() => setPly(last)}
            >
              ⏭
            </button>
            <button className="control" onClick={() => setFlipped(!flipped)}>
              {t.flip}
            </button>
            <button
              className="control"
              disabled={nextMiss < 0}
              onClick={() => {
                setRetryPly(undefined)
                setPly(nextMiss)
              }}
            >
              {labels.next}
            </button>
            {missed && (
              <button
                className="control"
                onClick={() => setRetryPly(retrying ? undefined : ply)}
              >
                {retrying ? labels.close : labels.retry}
              </button>
            )}
          </div>
          {grade && current.move && (
            <div className="mt-3 flex items-start gap-2 text-sm">
              <GradeIcon kind={grade.kind} />
              <p>
                {labels.move(current.move.san, labels.grade[grade.kind])}
                {missed && grade.bestSan && (
                  <span className="block text-slate-300">
                    {labels.recommend(grade.bestSan)}
                  </span>
                )}
              </p>
            </div>
          )}
          {retrying && (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showBest}
                onChange={(event) => setShowBest(event.target.checked)}
              />
              {labels.better}
            </label>
          )}
          <div className="mt-4">
            <GradeSummary data={classification} />
          </div>
        </div>
        <div className="min-w-0 space-y-4">
          <section className="panel">
            <h3 className="font-semibold">{t.graph}</h3>
            <p className="text-sm text-slate-300">{t.eval}</p>
            <div className="mt-2 h-44 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chart}
                  margin={{ top: 8, right: 12, bottom: 2, left: 0 }}
                  onClick={(state) => {
                    if (typeof state?.activeTooltipIndex === 'number')
                      setPly(state.activeTooltipIndex)
                  }}
                >
                  <XAxis
                    dataKey="ply"
                    tick={{ fill: '#cbd5e1', fontSize: 11 }}
                  />
                  <YAxis
                    domain={[-100, 100]}
                    ticks={[-100, 0, 100]}
                    width={38}
                    tick={{ fill: '#cbd5e1', fontSize: 11 }}
                  />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <ReferenceLine x={ply} stroke="#f8fafc" />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.[0]?.payload ? (
                        <div className="rounded bg-slate-800 px-2 py-1 text-sm text-slate-50">
                          {t.ply(payload[0].payload.ply)} ·{' '}
                          {payload[0].payload.label}
                        </div>
                      ) : null
                    }
                  />
                  <Area
                    type="linear"
                    dataKey="score"
                    stroke="#67e8f9"
                    fill="#164e63"
                    baseValue={0}
                    isAnimationActive={false}
                  />
                  <ReferenceDot
                    x={ply}
                    y={chart[ply].score ?? 0}
                    r={4}
                    fill="#f8fafc"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel">
            <h3 className="font-semibold">{t.lines}</h3>
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={more}
                onChange={(event) => setMore(event.target.checked)}
              />
              {t.moreArrows}
            </label>
            {evaluation.lines.length ? (
              <ol className="mt-3 space-y-2 text-sm">
                {evaluation.lines.map((line, index) => (
                  <li key={line.rank} className="flex gap-2">
                    <span
                      className="w-11 shrink-0 font-mono"
                      style={{ color: colors[index] }}
                    >
                      {formatScore(line.score)}
                    </span>
                    <span className="min-w-0 break-words font-mono">
                      {line.moves
                        .slice(0, 6)
                        .map((entry) => entry.san)
                        .join(' ')}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-slate-300">{t.terminal}</p>
            )}
          </section>
          <section className="panel">
            <h3 className="mb-2 font-semibold">{t.moves}</h3>
            <ol className="flex max-h-52 flex-wrap gap-1 overflow-auto">
              <li>
                <button
                  className="control aria-current:border-cyan-200"
                  aria-current={ply === 0}
                  onClick={() => setPly(0)}
                >
                  {t.start}
                </button>
              </li>
              {review.positions.map(
                ({ move }, index) =>
                  move && (
                    <li key={index}>
                      <button
                        className="control inline-flex items-center gap-1 font-mono aria-current:bg-cyan-200 aria-current:text-slate-950"
                        aria-current={ply === index}
                        onClick={() => setPly(index)}
                      >
                        {classification.grades[index] && (
                          <GradeIcon kind={classification.grades[index].kind} />
                        )}
                        {move.number}
                        {move.color === 'w' ? '.' : '…'} {move.san}
                      </button>
                    </li>
                  ),
              )}
            </ol>
          </section>
        </div>
      </div>
    </article>
  )
}

function EvalBar({
  score,
  flipped,
}: {
  score: ReviewScore | null
  flipped: boolean
}) {
  const white = ((evaluationScale(score) ?? 0) + 100) / 2
  return (
    <div
      aria-label={t.eval}
      className="relative overflow-hidden rounded-md border border-slate-600 bg-slate-800"
    >
      <div
        className={`absolute inset-x-0 bg-slate-100 transition-[height] duration-200 motion-reduce:transition-none ${flipped ? 'top-0' : 'bottom-0'}`}
        style={{ height: `${white}%` }}
      />
      <output className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-slate-950 py-1 text-center font-mono text-[10px] text-slate-50">
        {score ? formatScore(score) : '—'}
      </output>
    </div>
  )
}
