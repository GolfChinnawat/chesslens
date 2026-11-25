import { useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { cloud } from '../../lib/cloud'

export type Card = {
  game_id: string
  ply: number
  fen: string
  best: string
  box: number
  times_seen: number
  due_at: string
}
const days = [1, 2, 4, 8, 16]

export function Training({
  cards,
  onDone,
}: {
  cards: Card[]
  onDone: () => void
}) {
  const card = cards.find((entry) => Date.parse(entry.due_at) <= Date.now())
  const [message, setMessage] = useState('')
  const [hint, setHint] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!card) return <p>ยังไม่มีโจทย์ถึงกำหนด</p>
  const board = new Chess()
  try {
    board.load(card.fen)
  } catch {
    return <p>ตำแหน่งโจทย์ไม่ถูกต้อง</p>
  }

  async function answer(input: string) {
    if (!cloud || !card || busy) return
    let correct = false
    try {
      correct = board.move(input).lan === card.best
    } catch {
      setMessage('ลองใส่ตาที่เดินได้ เช่น Nf3 หรือ g1f3')
      return
    }
    const box = correct ? Math.min(card.box + 1, days.length - 1) : 0
    setBusy(true)
    const { data, error } = await cloud
      .from('mistake_positions')
      .update({
        box,
        times_seen: card.times_seen + 1,
        last_result: correct,
        due_at: new Date(
          Date.now() + (correct ? days[box] * 86_400_000 : 600_000),
        ).toISOString(),
      })
      .eq('game_id', card.game_id)
      .eq('ply', card.ply)
      .eq('times_seen', card.times_seen)
      .select('ply')
    setBusy(false)
    if (error || !data?.length) {
      setMessage('บันทึกผลไม่ได้ กรุณาโหลดข้อมูลใหม่')
      return
    }
    setHint(false)
    setMessage(
      correct
        ? 'ถูกต้อง'
        : 'ตาที่แนะนำคือ ' + card.best + ' โจทย์นี้จะกลับมาอีกใน 10 นาที',
    )
    onDone()
  }
  return (
    <div className="space-y-2">
      <div className="max-w-xs">
        <Chessboard
          customLightSquareStyle={{ backgroundColor: 'var(--board-light)' }}
          customDarkSquareStyle={{ backgroundColor: 'var(--board-dark)' }}
          position={card.fen}
          arePiecesDraggable={false}
          boardOrientation={board.turn() === 'w' ? 'white' : 'black'}
        />
      </div>
      <form
        key={card.game_id + card.ply}
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void answer(String(new FormData(event.currentTarget).get('move')))
        }}
      >
        <label>
          ตาที่ดีที่สุด{' '}
          <input name="move" className="control" required maxLength={12} />
        </label>
        <button className="control" disabled={busy}>
          ตอบ
        </button>
        <button
          type="button"
          className="control"
          onClick={() => setHint(!hint)}
        >
          คำใบ้
        </button>
      </form>
      {hint && <p>ลองเดินหมากจากช่อง {card.best.slice(0, 2)}</p>}
      {message && <p role="status">{message}</p>}
    </div>
  )
}
