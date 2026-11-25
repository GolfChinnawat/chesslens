import { Chess, type Color } from 'chess.js'
import { useMemo, useState, type FormEvent } from 'react'
import {
  maxOpeningPgnSize,
  openingLines,
  scheduleOpening,
  type OpeningLine,
  type OpeningProgress,
} from '../../analysis/opening-trainer'
import { PlayBoard } from '../../components/play-board'
import { localReviews } from '../../store/review-cache'

const storageKey = 'chesslens-opening-trainer-v1'
const cardKey = (line: OpeningLine, index: number) => line.id + ':' + index

type TrainerData = { pgn: string; side: Color; progress: OpeningProgress }

function loadTrainer(): TrainerData {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (
      saved &&
      typeof saved.pgn === 'string' &&
      (saved.side === 'w' || saved.side === 'b') &&
      saved.progress &&
      typeof saved.progress === 'object'
    )
      return saved
  } catch {
    // Storage may be unavailable in private browsing.
  }
  return { pgn: '', side: 'w', progress: {} }
}

export default function OpeningPage() {
  const [data, setData] = useState(loadTrainer)
  const [pgn, setPgn] = useState(data.pgn)
  const [side, setSide] = useState(data.side)
  const [selected, setSelected] = useState('')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState<{ text: string; fen: string }>()
  const [now, setNow] = useState(Date.now)
  const [reviews] = useState(localReviews)
  const lines = useMemo(() => {
    try {
      return data.pgn ? openingLines(data.pgn, data.side) : []
    } catch {
      return []
    }
  }, [data.pgn, data.side])
  const line = lines.find(({ id }) => id === selected) ?? lines[0]
  const index =
    line?.positions.findIndex(
      (_, i) => (data.progress[cardKey(line, i)]?.due ?? 0) <= now,
    ) ?? -1
  const position = line?.positions[index]
  const boardFen = feedback?.fen ?? position?.fen
  const game = useMemo(
    () => (boardFen ? new Chess(boardFen) : undefined),
    [boardFen],
  )
  const totals = line?.positions.reduce(
    (total, _, i) => {
      const progress = data.progress[cardKey(line, i)]
      return {
        attempts: total.attempts + (progress?.attempts ?? 0),
        correct: total.correct + (progress?.correct ?? 0),
      }
    },
    { attempts: 0, correct: 0 },
  )

  function save(next: TrainerData) {
    setData(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      return true
    } catch {
      setMessage('พื้นที่จัดเก็บไม่พร้อมใช้งาน ผลฝึกจะอยู่จนกว่าจะปิดหน้านี้')
      return false
    }
  }

  function load(text: string) {
    try {
      const imported = openingLines(text, side)
      if (!imported.length) {
        setMessage('ไม่พบตาของฝ่ายที่เลือกจากตำแหน่งเริ่มเกมมาตรฐาน')
        return
      }
      setSelected('')
      setFeedback(undefined)
      if (save({ ...data, pgn: text, side }))
        setMessage('พร้อมฝึก ' + imported.length + ' ไลน์')
    } catch {
      setMessage('อ่าน PGN ไม่สำเร็จ ตรวจรูปแบบและขนาดไฟล์ (ไม่เกิน 500 KB)')
    }
  }

  function answer(move: string) {
    if (!line || !position || !game || feedback) return
    try {
      const played = new Chess(position.fen).move(move)
      const correct = played.lan === position.uci
      const key = cardKey(line, index)
      const at = Date.now()
      save({
        ...data,
        progress: {
          ...data.progress,
          [key]: scheduleOpening(data.progress[key], correct, at),
        },
      })
      const solution = new Chess(position.fen).move(position.san)
      setFeedback({
        fen: solution.after,
        text: correct
          ? 'ถูกต้อง · ' + position.san
          : 'ตาในไลน์นี้คือ ' + position.san + ' · ฝึกซ้ำได้ใน 10 นาที',
      })
    } catch {
      setMessage('ลองใส่ตาที่เดินได้ เช่น Nf3 หรือ g1f3')
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    answer(String(new FormData(event.currentTarget).get('move')).trim())
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">ฝึกเปิดเกม</h1>
        <nav className="flex flex-wrap gap-3 text-cyan-200">
          <a href="./">เล่นกับบอท</a>
          <a href="?view=review">รีวิวเกม</a>
          <a href="?view=account">บัญชี</a>
        </nav>
      </header>
      <form
        className="panel space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          load(pgn)
        }}
      >
        <label className="block">
          PGN สำหรับฝึก (สูงสุด 8 ตาต่อฝ่าย)
          <textarea
            className="control mt-1 block w-full"
            rows={4}
            value={pgn}
            maxLength={maxOpeningPgnSize}
            onChange={(event) => setPgn(event.target.value)}
          />
        </label>
        <label className="block">
          เปิดไฟล์ PGN{' '}
          <input
            type="file"
            accept=".pgn"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              if (file.size > maxOpeningPgnSize) {
                setMessage('ไฟล์ต้องไม่เกิน 500 KB')
                return
              }
              try {
                setPgn(await file.text())
              } catch {
                setMessage('เปิดไฟล์ PGN ไม่สำเร็จ')
              }
            }}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <label>
            ฝ่ายที่ฝึก{' '}
            <select
              className="control"
              value={side}
              onChange={(event) =>
                setSide(event.target.value === 'b' ? 'b' : 'w')
              }
            >
              <option value="w">ขาว</option>
              <option value="b">ดำ</option>
            </select>
          </label>
          <button className="control" disabled={!pgn.trim()}>
            สร้างชุดฝึก
          </button>
          {!!reviews.length && (
            <button
              type="button"
              className="control"
              onClick={() => {
                const imported = [
                  ...new Set(reviews.map((review) => review.game.pgn)),
                ].join('\n\n')
                if (imported.length > maxOpeningPgnSize) {
                  setMessage('PGN รวมเกิน 500 KB ลองนำเข้าทีละไฟล์')
                  return
                }
                setPgn(imported)
                load(imported)
              }}
            >
              ใช้เกมที่เคยรีวิวในเครื่อง
            </button>
          )}
        </div>
      </form>
      {message && <p role="status">{message}</p>}
      {line && (
        <section className="panel space-y-3">
          <label>
            ไลน์ที่ฝึก{' '}
            <select
              className="control max-w-full"
              value={line.id}
              onChange={(event) => {
                setSelected(event.target.value)
                setFeedback(undefined)
                setNow(Date.now())
              }}
            >
              {lines.map((entry, i) => (
                <option key={entry.id} value={entry.id}>
                  ไลน์ {i + 1}
                  {entry.label && ' · ' + entry.label}
                </option>
              ))}
            </select>
          </label>
          {totals && (
            <p>
              ความแม่นยำของไลน์{' '}
              {totals.attempts
                ? Math.round((100 * totals.correct) / totals.attempts) + '%'
                : '—'}{' '}
              ({totals.correct}/{totals.attempts})
            </p>
          )}
          {game && boardFen ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="w-full max-w-sm">
                <PlayBoard
                  game={game}
                  fen={boardFen}
                  orientation={data.side}
                  canMove={!feedback}
                  play={({ from, to, promotion }) => {
                    answer(from + to + (promotion ?? ''))
                    return false
                  }}
                />
              </div>
              {feedback ? (
                <div className="space-y-2">
                  <p role="status">{feedback.text}</p>
                  <button
                    className="control"
                    onClick={() => {
                      setFeedback(undefined)
                      setMessage('')
                      setNow(Date.now())
                    }}
                  >
                    ตาถัดไป
                  </button>
                </div>
              ) : (
                <form
                  key={cardKey(line, index)}
                  className="space-y-2"
                  onSubmit={submit}
                >
                  <p>
                    ตาของฝ่าย{data.side === 'w' ? 'ขาว' : 'ดำ'} ·
                    ควรเดินอะไรในไลน์นี้?
                  </p>
                  <label className="block">
                    ตาที่เดิน{' '}
                    <input
                      name="move"
                      className="control w-full"
                      placeholder="Nf3"
                      maxLength={12}
                      required
                    />
                  </label>
                  <button className="control">ตอบ</button>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p>ไลน์นี้ไม่มีตาที่ถึงกำหนดฝึกแล้ว</p>
              <button className="control" onClick={() => setNow(Date.now())}>
                ตรวจรอบฝึกอีกครั้ง
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
