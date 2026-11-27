import { Chess } from 'chess.js'
import { lazy, useEffect, useMemo, useRef, useState } from 'react'
import {
  puzzleCandidates,
  puzzleDepth,
  puzzleThemes,
  qualifyPuzzle,
  type Puzzle,
} from '../../analysis/puzzles'
import { PlayBoard } from '../../components/play-board'
import { StockfishEngine } from '../../engine'
import { localReviews } from '../../store/review-cache'
import type { GameReview } from '../../types/review'

const SourceReview = lazy(() =>
  import('../Review/ReviewBoard').then(({ ReviewBoard }) => ({
    default: ReviewBoard,
  })),
)

async function loadCloudReviews(signal: AbortSignal) {
  if (!import.meta.env.VITE_SUPABASE_URL) return []
  const { cloud, cloudReview } = await import('../../lib/cloud')
  if (!cloud) return []
  const { data: auth, error: authError } = await cloud.auth.getSession()
  if (authError) throw authError
  if (!auth.session) return []
  const { data, error } = await cloud
    .from('games')
    .select('reviews(depth,payload)')
    .order('saved_at', { ascending: false })
    .order('id')
    .limit(20)
    .order('depth', { referencedTable: 'reviews', ascending: false })
    .limit(1, { referencedTable: 'reviews' })
    .abortSignal(signal)
  if (error) throw error
  return (data ?? []).flatMap(({ reviews }) => {
    try {
      return [cloudReview(reviews[0]?.payload)]
    } catch {
      return []
    }
  })
}

export default function PuzzlesPage() {
  const [side, setSide] = useState('both')
  const [puzzles, setPuzzles] = useState<Puzzle[]>([])
  const [index, setIndex] = useState(0)
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState('')
  const [showSource, setShowSource] = useState(false)
  const active = useRef<AbortController | null>(null)
  const puzzle = puzzles[index]

  useEffect(
    () => () => {
      active.current?.abort()
      active.current = null
    },
    [],
  )

  async function generate() {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    const { signal } = controller
    const engine = new StockfishEngine()
    setProgress('กำลังโหลดเกมที่เคยรีวิว…')
    setMessage('')
    setShowSource(false)
    setIndex(0)
    setPuzzles([])
    try {
      let cloud: GameReview[] = []
      try {
        cloud = await loadCloudReviews(signal)
      } catch {
        if (!signal.aborted) setMessage('โหลดคลังออนไลน์ไม่ได้ กำลังใช้รีวิวในเครื่อง')
      }
      signal.throwIfAborted()
      const reviews = [...localReviews(), ...cloud]
      const candidates = puzzleCandidates(reviews, side)
      const results: Puzzle[] = []
      for (const [i, candidate] of candidates.entries()) {
        setProgress(
          'Stockfish กำลังตรวจ ' +
            (i + 1) +
            ' / ' +
            candidates.length +
            ' ตำแหน่ง',
        )
        const result = await engine.analyze(candidate.fen, {
          depth: puzzleDepth,
          multiPV: 2,
          signal,
        })
        const verified = qualifyPuzzle(candidate, result)
        if (verified) results.push(verified)
        if (results.length >= 8) break
      }
      signal.throwIfAborted()
      setPuzzles(results)
      if (!results.length)
        setMessage((previous) =>
          [
            previous,
            reviews.length
              ? 'ยังไม่พบตำแหน่งที่ผ่านเกณฑ์ ลองเลือกอีกฝ่ายหรือรีวิวเกมเพิ่ม'
              : 'ยังไม่มีเกมที่รีวิวแล้ว ลองรีวิวเกมหรือลงชื่อเข้าใช้เพื่อโหลดคลัง',
          ]
            .filter(Boolean)
            .join(' · '),
        )
    } catch {
      if (active.current === controller)
        setMessage(
          signal.aborted ? 'หยุดตรวจตำแหน่งแล้ว' : 'สร้างโจทย์ไม่สำเร็จ ลองใหม่อีกครั้ง',
        )
    } finally {
      engine.destroy()
      if (active.current === controller) {
        active.current = null
        setProgress('')
      }
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-8">
      <header className="space-y-3 mb-4">
        <h1 className="text-2xl font-semibold sm:text-3xl">โจทย์จากเกมของคุณ</h1>
      </header>
      <section className="panel space-y-3">
        <h2 className="font-semibold">สร้างชุดโจทย์</h2>
        <p className="text-sm text-secondary">
          Stockfish คัดโจทย์รุกฆาตและชนะหมากจากรีวิวในเครื่องและเกมล่าสุดในคลัง
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">
            ฝึกฝ่าย{' '}
            <select
              className="control"
              value={side}
              disabled={!!progress}
              onChange={(event) => setSide(event.target.value)}
            >
              <option value="both">ทั้งสองฝ่าย</option>
              <option value="w">ขาว</option>
              <option value="b">ดำ</option>
            </select>
          </label>
          <button
            className="control primary-control"
            disabled={!!progress}
            onClick={() => void generate()}
          >
            สร้างโจทย์
          </button>
          {progress && (
            <button className="control" onClick={() => active.current?.abort()}>
              หยุด
            </button>
          )}
        </div>
        {(progress || message) && <p role="status">{progress || message}</p>}
      </section>
      {puzzle && (
        <PuzzleBoard
          key={index}
          puzzle={puzzle}
          number={index + 1}
          total={puzzles.length}
          onNext={() => {
            setIndex(index + 1)
            setShowSource(false)
          }}
          onSource={() => setShowSource(!showSource)}
          showSource={showSource}
        />
      )}
      {!puzzle && puzzles.length > 0 && (
        <section className="panel space-y-2">
          <p role="status">ฝึกครบ {puzzles.length} ข้อแล้ว</p>
          <button className="control" onClick={() => setIndex(0)}>
            ฝึกชุดนี้อีกครั้ง
          </button>
        </section>
      )}
      {puzzle && showSource && (
        <SourceReview review={puzzle.review} initialPly={puzzle.ply} />
      )}
    </main>
  )
}

function PuzzleBoard({
  puzzle,
  number,
  total,
  onNext,
  onSource,
  showSource,
}: {
  puzzle: Puzzle
  number: number
  total: number
  onNext: () => void
  onSource: () => void
  showSource: boolean
}) {
  const game = useMemo(() => new Chess(puzzle.fen), [puzzle.fen])
  const [state, setState] = useState<'start' | 'retry' | 'solved' | 'reveal'>(
    'start',
  )
  const done = state === 'solved' || state === 'reveal'
  const fen = done
    ? new Chess(puzzle.fen).move(puzzle.solution).after
    : puzzle.fen

  return (
    <section
      className="grid items-start gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
      aria-label="กระดานโจทย์"
    >
      <div className="panel w-full max-w-lg">
        <PlayBoard
          game={game}
          fen={fen}
          orientation={game.turn()}
          canMove={!done}
          play={({ from, to, promotion }) => {
            const correct = from + to + (promotion ?? '') === puzzle.solution
            setState(correct ? 'solved' : 'retry')
            return correct
          }}
        />
      </div>
      <div className="panel space-y-3">
        <h2 className="font-semibold">
          ข้อ {number} / {total} · {puzzleThemes[puzzle.theme]}
        </h2>
        <p role="status">
          {state === 'start'
            ? 'หาตาที่ดีที่สุดของฝ่าย' + (game.turn() === 'w' ? 'ขาว' : 'ดำ')
            : state === 'retry'
              ? 'ลองอีกครั้ง'
              : (state === 'solved' ? 'ถูกต้อง · ' : 'เฉลย · ') + puzzle.san}
        </p>
        <div className="flex flex-wrap gap-2">
          {done ? (
            <>
              <button className="control primary-control" onClick={onNext}>
                {number === total ? 'จบชุดฝึก' : 'ข้อถัดไป'}
              </button>
              <button
                className="control"
                aria-expanded={showSource}
                onClick={onSource}
              >
                {showSource ? 'ซ่อนเกมต้นฉบับ' : 'เปิดเกมต้นฉบับ'}
              </button>
            </>
          ) : (
            <button className="control" onClick={() => setState('reveal')}>
              ดูเฉลย
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
