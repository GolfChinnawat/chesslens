import { useEffect, useRef, useState } from 'react'
import { decodeEvaluation } from '../../analysis/review'
import { formatScore } from '../../analysis/score'
import { StockfishEngine } from '../../engine'
import type { GameReview, PositionEval } from '../../types/review'

export function DeepAnalysis({
  review,
  ply,
}: {
  review: GameReview
  ply: number
}) {
  const [count, setCount] = useState(3)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PositionEval>()
  const [error, setError] = useState(false)
  const active = useRef<AbortController>()
  useEffect(() => () => active.current?.abort(), [])

  async function start() {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    const engine = new StockfishEngine()
    const { fen, turn } = review.positions[ply]
    const moves = review.positions
      .slice(1, ply + 1)
      .flatMap(({ move }) => (move ? [move.uci] : []))
    setBusy(true)
    setError(false)
    setResult(undefined)
    try {
      const response = await engine.analyze(review.positions[0].fen, {
        depth: Math.min(24, review.depth + 4),
        movetime: 12_000,
        multiPV: count,
        moves,
        signal: controller.signal,
      })
      if (!controller.signal.aborted)
        setResult(decodeEvaluation(fen, turn, response.lines))
    } catch {
      if (!controller.signal.aborted) setError(true)
    } finally {
      engine.destroy()
      active.current = undefined
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return (
    <details className="mt-3 border-t border-line pt-2 text-sm">
      <summary className="cursor-pointer">วิเคราะห์ตำแหน่งนี้ให้ลึกขึ้น</summary>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label>
          แนวเดิน{' '}
          <select
            className="control"
            disabled={busy}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button
          className="control"
          disabled={busy}
          onClick={() => void start()}
        >
          วิเคราะห์เพิ่ม
        </button>
        {busy && (
          <button
            className="control"
            onClick={() => {
              active.current?.abort()
              setBusy(false)
            }}
          >
            หยุด
          </button>
        )}
      </div>
      {busy && <p role="status">กำลังวิเคราะห์ตำแหน่ง…</p>}
      {error && <p role="status">วิเคราะห์ตำแหน่งไม่สำเร็จ</p>}
      {result && (
        <ol className="mt-2 space-y-1">
          {result.lines.map((line) => (
            <li key={line.rank} className="break-words font-mono">
              d{line.depth} · {formatScore(line.score)} ·{' '}
              {line.moves
                .slice(0, 6)
                .map(({ san }) => san)
                .join(' ')}
            </li>
          ))}
        </ol>
      )}
    </details>
  )
}
