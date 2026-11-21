import { useState } from 'react'
import { Chess, type Color, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { GameReview } from '../../types/review'
import { missedClasses, type MoveGrade } from '../../analysis/classify'

export function Practice({
  review,
  grades,
  onClose,
}: {
  review: GameReview
  grades: (MoveGrade | undefined)[]
  onClose: () => void
}) {
  const [side, setSide] = useState<Color>(() =>
    review.game.username?.toLowerCase() ===
      review.game.headers.Black?.toLowerCase() && review.game.username
      ? 'b'
      : 'w',
  )
  const [index, setIndex] = useState(0)
  const entries = review.positions.flatMap(({ move }, ply) =>
    move?.color === side &&
    grades[ply] &&
    missedClasses.has(grades[ply]!.kind) &&
    review.evaluations[ply - 1].lines[0]?.moves[0]
      ? [ply]
      : [],
  )
  return (
    <section className="panel space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">ฝึกจากตาพลาด</h2>
        <button className="control" onClick={onClose}>
          กลับไปหน้ารีวิว
        </button>
      </div>
      <label className="text-sm">
        ฝึกฝ่าย{' '}
        <select
          className="control"
          value={side}
          onChange={(event) => {
            setSide(event.target.value as Color)
            setIndex(0)
          }}
        >
          <option value="w">ขาว</option>
          <option value="b">ดำ</option>
        </select>
      </label>
      {entries[index] === undefined ? (
        <p>{entries.length ? 'ฝึกครบแล้ว' : 'ไม่มีตาพลาดที่ใช้ฝึกสำหรับฝ่ายนี้'}</p>
      ) : (
        <>
          <p>
            ข้อ {index + 1} / {entries.length} · หาตาที่ Stockfish แนะนำ
          </p>
          <Exercise
            key={entries[index]}
            review={review}
            ply={entries[index]}
            side={side}
            onNext={() => setIndex(index + 1)}
          />
        </>
      )}
      {index === entries.length && index > 0 && (
        <button className="control" onClick={() => setIndex(0)}>
          เริ่มฝึกใหม่
        </button>
      )}
    </section>
  )
}

function Exercise({
  review,
  ply,
  side,
  onNext,
}: {
  review: GameReview
  ply: number
  side: Color
  onNext: () => void
}) {
  const fen = review.positions[ply - 1].fen
  const game = new Chess(fen)
  const best = review.evaluations[ply - 1].lines[0].moves[0]
  const from = best.uci.slice(0, 2) as Square
  const to = best.uci.slice(2, 4) as Square
  const [selected, setSelected] = useState<Square>()
  const [promotion, setPromotion] = useState<{ from: Square; to: Square }>()
  const [state, setState] = useState<'start' | 'wrong' | 'correct' | 'reveal'>(
    'start',
  )
  const [hint, setHint] = useState(false)
  const done = state === 'correct' || state === 'reveal'
  function attempt(start: Square, stop: Square, piece?: string) {
    if (done) return false
    const legal = game
      .moves({ square: start, verbose: true })
      .filter((move) => move.to === stop)
    if (!legal.length) return false
    if (legal[0].promotion && !piece) {
      setPromotion({ from: start, to: stop })
      return false
    }
    const move = legal.find((candidate) => candidate.promotion === piece)
    if (!move) return false
    const correct = move.lan === best.uci
    setState(correct ? 'correct' : 'wrong')
    setPromotion(undefined)
    setSelected(undefined)
    return correct
  }
  return (
    <div className="max-w-xl space-y-3">
      <Chessboard
        id="practice-board"
        position={state === 'correct' ? game.move(best.uci).after : fen}
        boardOrientation={side === 'w' ? 'white' : 'black'}
        arePiecesDraggable={!done}
        areArrowsAllowed={false}
        showPromotionDialog={false}
        customSquareStyles={Object.fromEntries(
          [selected, hint ? from : undefined]
            .filter(Boolean)
            .map((square) => [
              square,
              { boxShadow: 'inset 0 0 0 3px #a3e635' },
            ]),
        )}
        customArrows={state === 'reveal' ? [[from, to, '#a3e635']] : []}
        onPieceDrop={(start, stop) => attempt(start, stop)}
        onSquareClick={(square) => {
          if (
            !done &&
            !(
              selected &&
              game.get(square)?.color !== side &&
              attempt(selected, square)
            )
          )
            setSelected(game.get(square)?.color === side ? square : undefined)
        }}
      />
      {promotion && (
        <div role="group" aria-label="เลื่อนขั้นเบี้ย" className="flex gap-2">
          {['q', 'r', 'b', 'n'].map((piece) => (
            <button
              className="control uppercase"
              key={piece}
              onClick={() => attempt(promotion.from, promotion.to, piece)}
            >
              {piece}
            </button>
          ))}
        </div>
      )}
      <p role="status">
        {state === 'wrong'
          ? 'ลองหาตาอื่นอีกครั้ง'
          : state === 'correct'
            ? 'ถูกต้อง · ' + best.san
            : state === 'reveal'
              ? 'เฉลย · ' + best.san
              : hint
                ? 'ลองเดินหมากจากช่อง ' + from
                : 'เลือกหมากแล้วเลือกช่อง หรือใช้การลาก'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          className="control"
          disabled={done || hint}
          onClick={() => setHint(true)}
        >
          คำใบ้
        </button>
        <button
          className="control"
          disabled={done}
          onClick={() => {
            setPromotion(undefined)
            setState('reveal')
          }}
        >
          เฉลย
        </button>
        <button className="control" disabled={!done} onClick={onNext}>
          ข้อถัดไป
        </button>
      </div>
    </div>
  )
}
