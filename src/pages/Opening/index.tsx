import { translate } from '../../i18n/locale'
import { Chess, type Color } from 'chess.js'
import { useMemo, useState, type FormEvent } from 'react'
import {
  maxOpeningPgnSize,
  openingLines,
  openingChoices,
  openingAnswer,
  openingPositionKey,
  type OpeningMode,
  scheduleOpening,
  type OpeningLine,
  type OpeningProgress,
} from '../../analysis/opening-trainer'
import { PlayBoard } from '../../components/play-board'
import { localReviews } from '../../store/review-cache'
import './opening.css'

const storageKey = 'chesslens-opening-trainer-v1'
const cardKey = (line: OpeningLine, index: number) => line.id + ':' + index

type TrainerData = {
  pgn: string
  side: Color
  progress: OpeningProgress
  mode?: OpeningMode
}

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
  const mode: OpeningMode = data.mode === 'line' ? 'line' : 'repertoire'
  const choices = useMemo(() => openingChoices(lines), [lines])

  function progressKey(line: OpeningLine, index: number) {
    const key = cardKey(line, index)
    if (mode === 'line') return key
    const moves = choices.get(openingPositionKey(line.positions[index].fen))
    return (
      'repertoire:' + key + ':' + [...(moves?.keys() ?? [])].sort().join(',')
    )
  }

  const line = lines.find(({ id }) => id === selected) ?? lines[0]
  const index =
    line?.positions.findIndex(
      (_, i) => (data.progress[progressKey(line, i)]?.due ?? 0) <= now,
    ) ?? -1
  const position = line?.positions[index]
  const ready = !!position || !!feedback
  const boardFen = feedback?.fen ?? position?.fen ?? line?.positions.at(-1)?.fen
  const orientation = line ? data.side : side
  const game = useMemo(() => new Chess(boardFen), [boardFen])
  const totals = line?.positions.reduce(
    (total, _, i) => {
      const progress = data.progress[progressKey(line, i)]
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
      setMessage(
        translate(
          'พื้นที่จัดเก็บไม่พร้อมใช้งาน ผลฝึกจะอยู่จนกว่าจะปิดหน้านี้',
          'Storage is unavailable. Practice progress lasts until you close this page.',
        ),
      )
      return false
    }
  }

  function load(text: string) {
    try {
      const imported = openingLines(text, side)
      if (!imported.length) {
        setMessage(
          translate(
            'ไม่พบตาของฝ่ายที่เลือกจากตำแหน่งเริ่มเกมมาตรฐาน',
            'No moves were found for that side from the standard starting position',
          ),
        )
        return
      }
      setNow(Date.now())
      setSelected('')
      setFeedback(undefined)
      if (save({ ...data, pgn: text, side }))
        setMessage(
          translate('พร้อมฝึก ', 'Ready to practice ') +
            imported.length +
            translate(' ไลน์', ' opening line(s)'),
        )
    } catch {
      setMessage(
        translate(
          'อ่าน PGN ไม่สำเร็จ ตรวจรูปแบบและขนาดไฟล์ (ไม่เกิน 500 KB)',
          'Could not read PGN. Check the format and file size (up to 500 KB).',
        ),
      )
    }
  }

  function answer(move: string) {
    if (!line || !position || !game || feedback) return
    try {
      const { played, correct } = openingAnswer(position, move, mode, choices)
      const key = progressKey(line, index)
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
        fen: correct ? played.after : solution.after,
        correct,
        text: correct
          ? (played.lan === position.uci
              ? translate('ตรงไลน์ · ', 'On the selected line · ')
              : translate(
                  'ใช้ได้ในอีกไลน์ของชุดฝึก · ',
                  'Matches another line in this set · ',
                )) + played.san
          : translate('เดินได้ แต่นอก', 'Legal move, outside the') +
            (mode === 'line'
              ? translate('ไลน์ที่เลือก', 'selected line')
              : translate('ชุดฝึก', 'practice set')) +
            translate(' · ตาตัวอย่าง ', ' · Example move ') +
            position.san +
            translate(
              ' · ทบทวนอีกครั้งใน 10 นาที',
              ' · Review again in 10 minutes',
            ),
      })
    } catch {
      setMessage(
        translate(
          'ลองใส่ตาที่เดินได้ เช่น Nf3 หรือ g1f3',
          'Enter a legal move, such as Nf3 or g1f3',
        ),
      )
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    answer(String(new FormData(event.currentTarget).get('move')).trim())
  }

  return (
    <main className="opening">
      <div className="opening-intro">
        <h1>{translate('ฝึกเปิดเกม', 'Openings')}</h1>
        <p>
          {translate(
            'ซ้อมไลน์จากเกมของคุณ แล้วกลับมาทบทวนตาที่ถึงกำหนด',
            'Practice lines from your games and come back when moves are due for review.',
          )}
        </p>
      </div>

      <div className="opening-workspace" data-training={!!line}>
        <section
          className="opening-board"
          aria-label={translate('กระดานฝึกเปิดเกม', 'Opening practice board')}
        >
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
                <h2 id="opening-practice">
                  {translate('ชุดฝึกของคุณ', 'Your practice set')}
                </h2>
                <span className="opening-side">
                  {translate('ฝ่าย', 'Side: ')}
                  {data.side === 'w'
                    ? translate('ขาว', 'White')
                    : translate('ดำ', 'Black')}
                </span>
              </div>
              <label className="opening-field">
                {translate('ไลน์ที่ฝึก', 'Line to practice')}
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
                      {translate('ไลน์', 'Line')} {i + 1}
                      {entry.label && ' · ' + entry.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="opening-field">
                {translate('โหมดฝึก', 'Practice mode')}
                <select
                  className="control"
                  value={mode}
                  onChange={(event) => {
                    setFeedback(undefined)
                    setMessage('')
                    setNow(Date.now())
                    save({
                      ...data,
                      mode:
                        event.target.value === 'line' ? 'line' : 'repertoire',
                    })
                  }}
                >
                  <option value="repertoire">
                    {translate(
                      'ยืดหยุ่น · รับทุกไลน์ที่นำเข้า',
                      'Flexible · Accept all imported lines',
                    )}
                  </option>
                  <option value="line">
                    {translate(
                      'จำไลน์ · รับเฉพาะไลน์ที่เลือก',
                      'Memorize · Accept only the selected line',
                    )}
                  </option>
                </select>
              </label>
              <p className="opening-hint">
                {translate(
                  'คะแนนวัดว่าตรงกับ',
                  'Your score measures how often you match the',
                )}
                {mode === 'line'
                  ? translate('ไลน์ที่เลือก', 'selected line')
                  : translate('ชุดฝึก', 'practice set')}{' '}
                {translate('จากตำแหน่งเดียวกัน', 'from the same position')}
              </p>
              {totals && (
                <p className="opening-accuracy">
                  {translate('ตอบตรงตามเกณฑ์', 'Accepted moves')}{' '}
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
                      className="control primary-control"
                      onClick={() => {
                        setFeedback(undefined)
                        setMessage('')
                        setNow(Date.now())
                      }}
                    >
                      {translate('ตาถัดไป', 'Next move')}
                    </button>
                  </div>
                ) : ready ? (
                  <form
                    key={progressKey(line, index)}
                    className="opening-move"
                    onSubmit={submit}
                  >
                    <p>
                      {translate(
                        'เดินบนกระดานหรือพิมพ์ตาที่ต้องการ',
                        'Play a move on the board or enter it below',
                      )}
                    </p>
                    <label className="opening-field">
                      {translate('ตาที่เดิน', 'Your move')}
                      <input
                        name="move"
                        className="control"
                        placeholder={translate('เช่น Nf3', 'E.g. Nf3')}
                        maxLength={12}
                        autoComplete="off"
                        required
                      />
                    </label>
                    <button className="control primary-control">
                      {translate('ตอบ', 'Submit')}
                    </button>
                  </form>
                ) : (
                  <div className="opening-result">
                    <p>
                      {translate(
                        'ไลน์นี้ไม่มีตาที่ถึงกำหนดฝึกแล้ว',
                        'No moves are due in this line',
                      )}
                    </p>
                    <button
                      className="control"
                      onClick={() => setNow(Date.now())}
                    >
                      {translate('ตรวจรอบฝึกอีกครั้ง', 'Check for due moves again')}
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
              <h2>
                {line
                  ? translate('เปลี่ยนชุดฝึก', 'Change practice set')
                  : translate('สร้างชุดฝึก', 'Create practice set')}
              </h2>
            </div>
            <label className="opening-field">
              {translate('PGN สำหรับฝึก', 'Practice PGN')}
              <textarea
                className="control"
                rows={4}
                value={pgn}
                maxLength={maxOpeningPgnSize}
                placeholder="1. e4 e5 2. Nf3 Nc6 *"
                onChange={(event) => setPgn(event.target.value)}
              />
            </label>
            <p className="opening-hint">
              {translate(
                'ใช้ 8 ตาแรกต่อฝ่าย · ไฟล์ไม่เกิน 500 KB',
                'Uses the first eight moves per side · Files up to 500 KB',
              )}
            </p>
            <label className="opening-file">
              <input
                type="file"
                accept=".pgn"
                aria-label={translate('เปิดไฟล์ PGN', 'Open PGN file')}
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (!file) return
                  if (file.size > maxOpeningPgnSize) {
                    setMessage(
                      translate(
                        'ไฟล์ต้องไม่เกิน 500 KB',
                        'File must be no larger than 500 KB',
                      ),
                    )
                    return
                  }
                  try {
                    setPgn(await file.text())
                    setMessage(
                      translate(
                        'เลือกไฟล์แล้ว กดสร้างชุดฝึกเพื่อเริ่ม',
                        'File selected. Create a practice set to begin.',
                      ),
                    )
                  } catch {
                    setMessage(
                      translate(
                        'เปิดไฟล์ PGN ไม่สำเร็จ',
                        'Could not open PGN file',
                      ),
                    )
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
                {translate('ใช้ PGN ตัวอย่าง', 'Use sample PGN')}
              </button>
            )}
            <div className="opening-import-actions">
              <label className="opening-field">
                {translate('ฝ่ายที่ฝึก', 'Side to practice')}
                <select
                  className="control"
                  value={side}
                  onChange={(event) =>
                    setSide(event.target.value === 'b' ? 'b' : 'w')
                  }
                >
                  <option value="w">{translate('ขาว', 'White')}</option>
                  <option value="b">{translate('ดำ', 'Black')}</option>
                </select>
              </label>
              <button
                className="control primary-control"
                disabled={!pgn.trim()}
              >
                {translate('สร้างชุดฝึก', 'Create practice set')}
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
                    setMessage(
                      translate(
                        'PGN รวมเกิน 500 KB ลองนำเข้าทีละไฟล์',
                        'Combined PGN exceeds 500 KB. Try importing one file at a time.',
                      ),
                    )
                    return
                  }
                  setPgn(imported)
                  load(imported)
                }}
              >
                {translate('ใช้เกมที่เคยรีวิวในเครื่อง', 'Use locally reviewed games')}
              </button>
            )}
          </form>
        </aside>
      </div>
    </main>
  )
}
