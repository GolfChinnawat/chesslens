import { lazy, Suspense } from 'react'
import { useReviewSound } from './useReviewSound'
import { PlanBoard } from './PlanBoard'
import { DeepAnalysis } from './DeepAnalysis'
import { Practice } from './Practice'
import { reviewSummary } from '../../analysis/review-summary'
import { findOpening } from '../../analysis/openings'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import type { GameReview, PositionEval, ReviewScore } from '../../types/review'

import { classifyReview, missedClasses } from '../../analysis/classify'
import { classificationText as labels } from '../../i18n/classification-th'
import { GradeIcon, GradeSummary } from './MoveGrade'
import { RetryMove } from './RetryMove'

const CloudSave = lazy(() =>
  import('../Account/CloudSave').then(({ CloudSave }) => ({
    default: CloudSave,
  })),
)

const colors = ['#a3e635', '#38bdf8', '#fb923c', '#c4b5fd', '#f9a8d4']

export function ReviewBoard({
  review,
  analyzing = false,
  initialPly = 0,
}: {
  review: GameReview
  initialPly?: number
  analyzing?: boolean
}) {
  const layout = useRef<HTMLDivElement>(null)
  const boardRow = useRef<HTMLDivElement>(null)
  const [modeControls, setModeControls] = useState<HTMLDivElement | null>(null)
  const [fit, setFit] = useState<{ board: number; sidebar: number }>()
  const [planning, setPlanning] = useState(false)
  const [practice, setPractice] = useState(false)
  const [auto, setAuto] = useState(false)
  const [ply, setPly] = useState(initialPly)
  const [flipped, setFlipped] = useState(false)
  const [more, setMore] = useState(false)
  const [mode, setMode] = useState<'after' | 'before' | 'retry'>('after')
  const [trial, setTrial] = useState<PositionEval | null>()
  const changePly = useCallback((index: number, before = false) => {
    setPlanning(false)
    setPly(index)
    setMode(before ? 'before' : 'after')
    setTrial(undefined)
  }, [])
  const [showBest, setShowBest] = useState(false)
  const classification = useMemo(() => classifyReview(review), [review])
  const summary = useMemo(
    () => reviewSummary(review, classification.grades),
    [review, classification.grades],
  )
  const grade = classification.grades[ply]
  const missed = !!grade && missedClasses.has(grade.kind)
  const retrying = missed && mode === 'retry'
  const beforeMove = missed && mode !== 'after'
  const boardPly = beforeMove ? ply - 1 : ply
  const triedMove = retrying && trial !== undefined
  const nextMiss = classification.grades.findIndex(
    (item, index) => index > ply && item && missedClasses.has(item.kind),
  )
  const last = review.positions.length - 1
  const current = review.positions[ply]
  const evaluation = triedMove ? trial : review.evaluations[boardPly]

  const sound = useReviewSound(boardPly, review.positions[boardPly]?.move?.san)

  useEffect(() => {
    const container = layout.current
    const row = boardRow.current
    if (practice || !container || !row) return

    function measure() {
      if (!container || !row) return
      const viewport = window.innerHeight
      const sidebar = Math.floor(
        viewport - container.getBoundingClientRect().top - window.scrollY - 16,
      )
      const board = Math.floor(
        // Reserve space for the player label and navigation without measuring changing move details.
        viewport - row.getBoundingClientRect().top - window.scrollY - 156,
      )
      const next =
        window.matchMedia('(min-width: 1024px)').matches && board >= 230
          ? { board, sidebar }
          : undefined
      setFit((current) =>
        current?.board === next?.board && current?.sidebar === next?.sidebar
          ? current
          : next,
      )
    }

    window.addEventListener('resize', measure)
    measure()
    return () => {
      window.removeEventListener('resize', measure)
    }
  }, [practice, analyzing])

  useEffect(() => {
    if (!auto || practice || ply >= last) return
    const timer = setTimeout(() => changePly(ply + 1), 1100)
    return () => clearTimeout(timer)
  }, [auto, practice, ply, last, changePly])

  useEffect(() => {
    if (practice) return
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
          changePly(Math.max(0, ply - 1))
          break
        case 'ArrowRight':
          changePly(Math.min(last, ply + 1))
          break
        case 'Home':
          changePly(0)
          break
        case 'End':
          changePly(last)
          break
        default:
          return
      }
      event.preventDefault()
    }
    window.addEventListener('keydown', navigate)
    return () => window.removeEventListener('keydown', navigate)
  }, [changePly, last, ply, practice])

  const arrows = (evaluation?.lines ?? [])
    .slice(0, retrying && !triedMove ? (showBest ? 1 : 0) : more ? 5 : 1)
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
  const move = beforeMove ? undefined : current.move?.uci
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

  const opening = useMemo(() => {
    for (let index = boardPly; index > 0; index--) {
      const found = findOpening(review.positions[index].fen)
      if (found) return found
    }
  }, [boardPly, review.positions])
  const average = (values: number[]) =>
    values.length
      ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) + '%'
      : '—'
  if (practice)
    return (
      <Practice
        review={review}
        grades={classification.grades}
        onClose={() => setPractice(false)}
      />
    )

  return (
    <article className="review-layout space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-sm font-medium text-slate-100">
            {t.players(White ?? t.unknown, Black ?? t.unknown)}
          </h2>
          <p className="mt-1 break-words text-xs text-muted">
            {[
              Result,
              Date,
              opening ? `${opening.eco} · ${opening.name}` : ECO,
              `${t.depth} ${review.depth}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!analyzing && import.meta.env.VITE_SUPABASE_URL && (
            <Suspense>
              <CloudSave review={review} />
            </Suspense>
          )}
          <button
            className="control"
            disabled={analyzing}
            onClick={() => {
              setAuto(false)
              setPractice(true)
            }}
          >
            ฝึกจากตาพลาด
          </button>
          <button
            className="control"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([review.game.pgn], {
                  type: 'application/x-chess-pgn',
                }),
              )
              const link = document.createElement('a')
              link.href = url
              link.download = 'chesslens-review.pgn'
              link.click()
              setTimeout(() => URL.revokeObjectURL(url), 1000)
            }}
          >
            ดาวน์โหลด PGN
          </button>
          <button
            type="button"
            className="control min-w-20"
            aria-pressed={sound.enabled}
            onClick={sound.toggle}
          >
            {sound.enabled ? t.soundOn : t.soundOff}
          </button>
          <details className="control relative">
            <summary className="cursor-pointer">คีย์ลัด</summary>
            <p className="absolute right-0 top-full z-30 mt-1 w-56 rounded-md border border-edge bg-surface p-3 shadow-lg">
              ← / → ย้อนหรือไปต่อ · Home / End ไปต้นหรือท้ายเกม
            </p>
          </details>
        </div>
      </header>
      <div
        ref={layout}
        className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,25rem)] lg:gap-7"
      >
        <div className="mx-auto w-full min-w-0 max-w-3xl">
          <PlayerStrip
            color={flipped ? 'w' : 'b'}
            name={flipped ? White : Black}
          />
          <div
            ref={boardRow}
            style={fit ? { maxWidth: fit.board + 42 } : undefined}
            className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 sm:grid-cols-[2rem_minmax(0,1fr)]"
          >
            <EvalBar
              score={planning ? null : (evaluation?.score ?? null)}
              flipped={flipped}
            />
            <section
              aria-label={t.board}
              className="relative min-w-0 overflow-hidden rounded-lg border border-line"
            >
              {planning ? (
                <PlanBoard
                  key={boardPly}
                  controls={modeControls}
                  fen={review.positions[boardPly].fen}
                  flipped={flipped}
                />
              ) : retrying ? (
                <RetryMove
                  key={ply}
                  controls={modeControls}
                  review={review}
                  ply={ply}
                  flipped={flipped}
                  arrows={arrows}
                  onTrial={setTrial}
                />
              ) : (
                <>
                  <Chessboard
                    id="review-board"
                    position={review.positions[boardPly].fen}
                    boardOrientation={flipped ? 'black' : 'white'}
                    areArrowsAllowed={false}
                    arePiecesDraggable={false}
                    customArrows={arrows}
                    customLightSquareStyle={{ backgroundColor: 'var(--board-light)' }}
                    customDarkSquareStyle={{ backgroundColor: 'var(--board-dark)' }}
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
          <div>
            <PlayerStrip
              color={flipped ? 'b' : 'w'}
              name={flipped ? Black : White}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="control"
                aria-label={t.first}
                disabled={ply === 0}
                onClick={() => changePly(0)}
              >
                ⏮
              </button>
              <button
                className="control"
                aria-label={t.previous}
                disabled={ply === 0}
                onClick={() => changePly(ply - 1)}
              >
                ◀
              </button>
              <button
                className="control"
                aria-label={t.next}
                disabled={ply === last}
                onClick={() => changePly(ply + 1)}
              >
                ▶
              </button>
              <button
                className="control"
                aria-label={t.last}
                disabled={ply === last}
                onClick={() => changePly(last)}
              >
                ⏭
              </button>
              <button className="control" onClick={() => setFlipped(!flipped)}>
                {t.flip}
              </button>
              <button
                className="control"
                disabled={nextMiss < 0}
                onClick={() => changePly(nextMiss, true)}
              >
                {labels.next}
              </button>
              <button
                className="control"
                disabled={ply === last || retrying || planning}
                onClick={() => setAuto(!auto)}
              >
                {auto && ply < last ? 'หยุดเล่นอัตโนมัติ' : 'เล่นย้อนหลังอัตโนมัติ'}
              </button>
              <button
                className="control"
                aria-pressed={planning}
                disabled={retrying}
                onClick={() => {
                  setAuto(false)
                  setPlanning(!planning)
                }}
              >
                {planning ? labels.planExit : labels.plan}
              </button>
              {missed && !retrying && !planning && (
                <button
                  className="control"
                  onClick={() => setMode(beforeMove ? 'after' : 'before')}
                >
                  {beforeMove ? labels.viewAfter : labels.viewBefore}
                </button>
              )}
              {missed && !planning && (
                <button
                  className="control"
                  onClick={() => {
                    setTrial(undefined)
                    setAuto(false)
                    setMode(retrying ? 'after' : 'retry')
                  }}
                >
                  {retrying ? labels.close : labels.retry}
                </button>
              )}
            </div>
            <div ref={setModeControls} className="empty:hidden mt-3" />
            {!planning && grade && current.move && (
              <div className="mt-3 flex items-start gap-2 text-sm">
                <GradeIcon kind={grade.kind} />
                <p>
                  <span className="block text-secondary">
                    {triedMove
                      ? labels.trialPosition
                      : beforeMove
                        ? labels.beforePosition
                        : labels.afterPosition}
                  </span>
                  {labels.move(current.move.san, labels.grade[grade.kind])}
                  {beforeMove && !triedMove && grade.bestSan && (
                    <span className="block text-secondary">
                      {labels.recommend(grade.bestSan)}
                    </span>
                  )}
                </p>
              </div>
            )}
            {analyzing && current.move && !grade && (
              <p className="mt-2 text-sm text-secondary" role="status">
                {labels.pendingGrade}
              </p>
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
          </div>
        </div>
        <aside
          style={fit ? { height: fit.sidebar } : undefined}
          className={`min-w-0 space-y-3 ${fit ? 'overflow-y-auto overscroll-contain [scrollbar-gutter:stable] pr-2' : ''}`}
          aria-label={labels.summary}
          tabIndex={fit ? 0 : undefined}
        >
          <section className="panel">
            <h3 className="font-semibold">{t.graph}</h3>
            <p className="text-sm text-secondary">{t.eval}</p>
            <div className="mt-2 h-28 w-full min-w-0 sm:h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chart}
                  margin={{ top: 8, right: 12, bottom: 2, left: 0 }}
                  onClick={(state) => {
                    if (typeof state?.activeTooltipIndex === 'number')
                      changePly(state.activeTooltipIndex)
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
                  {!triedMove && (
                    <ReferenceLine x={boardPly} stroke="#f8fafc" />
                  )}
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.[0]?.payload ? (
                        <div className="rounded bg-raised px-2 py-1 text-sm text-foreground">
                          {t.ply(payload[0].payload.ply)} ·{' '}
                          {payload[0].payload.label}
                        </div>
                      ) : null
                    }
                  />
                  <Area
                    type="linear"
                    dataKey="score"
                    stroke="var(--color-accent)"
                    fill="var(--chart-fill)"
                    baseValue={0}
                    isAnimationActive={false}
                  />
                  {!triedMove && (
                    <ReferenceDot
                      x={boardPly}
                      y={chart[boardPly].score ?? 0}
                      r={4}
                      fill="#f8fafc"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
          <GradeSummary data={classification} names={[White, Black]} />
          <details className="panel space-y-2">
            <summary className="cursor-pointer font-semibold">
              จุดเปลี่ยนและความแม่นยำแยกช่วงเกม
            </summary>

            {summary.swings.length ? (
              <ol className="flex flex-wrap gap-2">
                {summary.swings.map(({ ply, move, swing }) => (
                  <li key={ply}>
                    <button
                      className="control"
                      onClick={() => changePly(ply, true)}
                    >
                      {move.number}
                      {move.color === 'w' ? '.' : '…'} {move.san} · −
                      {swing.toFixed(1)} จุด
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm">ยังไม่มีคะแนนประเมินที่ลดลง</p>
            )}
            <table className="w-full text-sm">
              <caption className="text-left font-semibold">
                ความแม่นยำแยกช่วงเกม
              </caption>
              <thead>
                <tr>
                  <td />
                  <th scope="col">ขาว</th>
                  <th scope="col">ดำ</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['opening', 'เปิดเกม'],
                    ['middle', 'กลางเกม'],
                    ['end', 'ท้ายเกม'],
                  ] as const
                ).map(([phase, label]) => (
                  <tr key={phase}>
                    <th scope="row" className="text-left">
                      {label}
                    </th>
                    <td className="text-center">
                      {average(summary.phases[phase].w)}
                    </td>
                    <td className="text-center">
                      {average(summary.phases[phase].b)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <section className="panel">
            <h3 className="font-semibold">{t.lines}</h3>
            {!planning && (!retrying || triedMove) && (
              <label className="mt-2 flex items-center gap-2 text-sm text-secondary">
                <input
                  type="checkbox"
                  checked={more}
                  onChange={(event) => setMore(event.target.checked)}
                />
                แนวเดินเพิ่มเติม
              </label>
            )}
            {planning ? (
              <p className="mt-2 text-sm text-secondary">{labels.planHelp}</p>
            ) : evaluation?.lines.length ? (
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
              <p className="mt-2 text-sm text-secondary">
                {evaluation?.score
                  ? t.terminal
                  : retrying
                    ? labels.evaluation
                    : t.terminal}
              </p>
            )}
            {!planning &&
              !analyzing &&
              !retrying &&
              !review.positions[boardPly].terminal && (
                <DeepAnalysis key={boardPly} review={review} ply={boardPly} />
              )}
          </section>
          <section className="panel">
            <h3 className="mb-2 font-semibold">{t.moves}</h3>
            <ol className="flex max-h-52 flex-wrap gap-1 overflow-auto">
              <li>
                <button
                  className="control aria-current:border-accent"
                  aria-current={ply === 0}
                  onClick={() => changePly(0)}
                >
                  {t.start}
                </button>
              </li>
              {review.positions.map(
                ({ move }, index) =>
                  move && (
                    <li key={index}>
                      <button
                        className="control inline-flex items-center gap-1 font-mono aria-current:bg-accent aria-current:text-canvas"
                        aria-current={ply === index}
                        onClick={() => changePly(index)}
                      >
                        {classification.grades[index] && (
                          <GradeIcon kind={classification.grades[index].kind} />
                        )}
                        {move.number}
                        {move.color === 'w' ? '.' : '…'} {move.san}
                        {classification.grades[index] && (
                          <span className="ml-1 font-sans font-semibold">
                            {
                              labels.grade[
                                classification.grades[index].kind
                              ].split(' · ')[0]
                            }
                          </span>
                        )}
                      </button>
                    </li>
                  ),
              )}
            </ol>
          </section>
        </aside>
      </div>
    </article>
  )
}

function PlayerStrip({ color, name }: { color: 'w' | 'b'; name?: string }) {
  return (
    <div className="ml-9 flex min-w-0 items-center gap-2 py-2 text-sm sm:ml-10">
      <span
        aria-hidden="true"
        className={`size-3 shrink-0 rounded-full border border-subtle ${color === 'w' ? 'bg-slate-100' : 'bg-canvas'}`}
      />
      <span className="truncate font-semibold" title={name}>
        {name && name !== '?' ? name : color === 'w' ? t.white : t.black}
      </span>
      <span className="shrink-0 text-xs text-muted">
        {color === 'w' ? t.white : t.black}
      </span>
    </div>
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
      className="relative overflow-hidden rounded-md border border-edge bg-raised"
    >
      <div
        className={`absolute inset-x-0 bg-slate-100 transition-[height] duration-200 motion-reduce:transition-none ${flipped ? 'top-0' : 'bottom-0'}`}
        style={{ height: `${white}%` }}
      />
      <output className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-canvas py-1 text-center font-mono text-[10px] text-foreground">
        {score ? formatScore(score) : '—'}
      </output>
    </div>
  )
}
