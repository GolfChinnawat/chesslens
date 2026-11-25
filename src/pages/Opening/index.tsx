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
import './opening.css'

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
  const [feedback, setFeedback] = useState<{
    text: string
    fen: string
    correct: boolean
  }>()
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
  const ready = !!position || !!feedback
  const boardFen = feedback?.fen ?? position?.fen ?? line?.positions.at(-1)?.fen
  const orientation = line ? data.side : side
  const game = useMemo(() => new Chess(boardFen), [boardFen])
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
      setNow(Date.now())
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
      setMessage('')
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
        correct,
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
    <main className="opening">
      <header className="opening-header">
        <a className="opening-brand" href="./">
          ChessLens
        </a>
        <nav aria-label="เมนูหลัก">
          <a href="./">เล่นกับบอท</a>
          <a href="?view=review">รีวิวเกม</a>
          <a href="?view=opening" aria-current="page">
            ฝึกเปิดเกม
          </a>
          <a href="?view=account">บัญชี</a>
        </nav>
      </header>

      <div className="opening-intro">
        <h1>ฝึกเปิดเกม</h1>
        <p>ซ้อมไลน์จากเกมของคุณ แล้วกลับมาทบทวนตาที่ถึงกำหนด</p>
      </div>

      <div className="opening-workspace" data-training={!!line}>
        <section className="opening-board" aria-label="กระดานฝึกเปิดเกม">
          <div className="opening-board-frame">
            <PlayBoard
              game={game}
              fen={game.fen()}
              orientation={orientation}
              canMove={ready && !feedback}
              play={({ from, to, promotion }) => {
                answer(from + to + (promotion ?? ''))
                return false
              }}
            />
          </div>
        </section>

        <aside className="opening-sidebar">
          {line && (
            <section
              className="opening-card"
              aria-labelledby="opening-practice"
            >
              <div className="opening-card-heading">
                <h2 id="opening-practice">ชุดฝึกของคุณ</h2>
                <span className="opening-side">
                  ฝ่าย{data.side === 'w' ? 'ขาว' : 'ดำ'}
                </span>
              </div>
              <label className="opening-field">
                ไลน์ที่ฝึก
                <select
                  className="control"
                  value={line.id}
                  onChange={(event) => {
                    setSelected(event.target.value)
                    setFeedback(undefined)
                    setMessage('')
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
                <p className="opening-accuracy">
                  ความแม่นยำของไลน์{' '}
                  <strong>
                    {totals.attempts
                      ? Math.round((100 * totals.correct) / totals.attempts) +
                        '%'
                      : '—'}
                  </strong>{' '}
                  <span>
                    ({totals.correct}/{totals.attempts})
                  </span>
                </p>
              )}
              <div className="opening-answer">
                {feedback ? (
                  <div
                    className="opening-result"
                    data-correct={feedback.correct}
                  >
                    <p role="status">{feedback.text}</p>
                    <button
                      className="control opening-primary"
                      onClick={() => {
                        setFeedback(undefined)
                        setMessage('')
                        setNow(Date.now())
                      }}
                    >
                      ตาถัดไป
                    </button>
                  </div>
                ) : ready ? (
                  <form
                    key={cardKey(line, index)}
                    className="opening-move"
                    onSubmit={submit}
                  >
                    <p>เดินบนกระดานหรือพิมพ์ตาที่ต้องการ</p>
                    <label className="opening-field">
                      ตาที่เดิน
                      <input
                        name="move"
                        className="control"
                        placeholder="เช่น Nf3"
                        maxLength={12}
                        autoComplete="off"
                        required
                      />
                    </label>
                    <button className="control opening-primary">ตอบ</button>
                  </form>
                ) : (
                  <div className="opening-result">
                    <p>ไลน์นี้ไม่มีตาที่ถึงกำหนดฝึกแล้ว</p>
                    <button
                      className="control"
                      onClick={() => setNow(Date.now())}
                    >
                      ตรวจรอบฝึกอีกครั้ง
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {message && (
            <p className="opening-notice" role="status">
              {message}
            </p>
          )}

          <form
            className="opening-card opening-import"
            onSubmit={(event) => {
              event.preventDefault()
              load(pgn)
            }}
          >
            <div className="opening-card-heading">
              <h2>{line ? 'เปลี่ยนชุดฝึก' : 'สร้างชุดฝึก'}</h2>
            </div>
            <label className="opening-field">
              PGN สำหรับฝึก
              <textarea
                className="control"
                rows={4}
                value={pgn}
                maxLength={maxOpeningPgnSize}
                placeholder="1. e4 e5 2. Nf3 Nc6 *"
                onChange={(event) => setPgn(event.target.value)}
              />
            </label>
            <p className="opening-hint">ใช้ 8 ตาแรกต่อฝ่าย · ไฟล์ไม่เกิน 500 KB</p>
            <label className="opening-file">
              <input
                type="file"
                accept=".pgn"
                aria-label="เปิดไฟล์ PGN"
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
                    setMessage('เลือกไฟล์แล้ว กดสร้างชุดฝึกเพื่อเริ่ม')
                  } catch {
                    setMessage('เปิดไฟล์ PGN ไม่สำเร็จ')
                  }
                }}
              />
            </label>
            {!line && !pgn && (
              <button
                type="button"
                className="opening-link"
                onClick={() => setPgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *')}
              >
                ใช้ PGN ตัวอย่าง
              </button>
            )}
            <div className="opening-import-actions">
              <label className="opening-field">
                ฝ่ายที่ฝึก
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
              <button
                className="control opening-primary"
                disabled={!pgn.trim()}
              >
                สร้างชุดฝึก
              </button>
            </div>
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
          </form>
        </aside>
      </div>
    </main>
  )
}
