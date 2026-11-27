import { translate } from '../../i18n/locale'
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
    setProgress(translate('กำลังโหลดเกมที่เคยรีวิว…', 'Loading reviewed games…'))
    setMessage('')
    setShowSource(false)
    setIndex(0)
    setPuzzles([])
    try {
      let cloud: GameReview[] = []
      try {
        cloud = await loadCloudReviews(signal)
      } catch {
        if (!signal.aborted)
          setMessage(
            translate(
              'โหลดคลังออนไลน์ไม่ได้ กำลังใช้รีวิวในเครื่อง',
              'Could not load the online library. Using local reviews.',
            ),
          )
      }
      signal.throwIfAborted()
      const reviews = [...localReviews(), ...cloud]
      const candidates = puzzleCandidates(reviews, side)
      const results: Puzzle[] = []
      for (const [i, candidate] of candidates.entries()) {
        setProgress(
          translate('Stockfish กำลังตรวจ ', 'Stockfish is checking ') +
            (i + 1) +
            ' / ' +
            candidates.length +
            translate(' ตำแหน่ง', ' position(s)'),
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
              ? translate(
                  'ยังไม่พบตำแหน่งที่ผ่านเกณฑ์ ลองเลือกอีกฝ่ายหรือรีวิวเกมเพิ่ม',
                  'No eligible positions found. Try the other side or review more games.',
                )
              : translate(
                  'ยังไม่มีเกมที่รีวิวแล้ว ลองรีวิวเกมหรือลงชื่อเข้าใช้เพื่อโหลดคลัง',
                  'No reviewed games yet. Review a game or sign in to load your library.',
                ),
          ]
            .filter(Boolean)
            .join(' · '),
        )
    } catch {
      if (active.current === controller)
        setMessage(
          signal.aborted
            ? translate('หยุดตรวจตำแหน่งแล้ว', 'Position search stopped')
            : translate(
                'สร้างโจทย์ไม่สำเร็จ ลองใหม่อีกครั้ง',
                'Could not generate puzzles. Try again.',
              ),
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
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {translate('โจทย์จากเกมของคุณ', 'Puzzles from your games')}
        </h1>
      </header>
      <section className="panel space-y-3">
        <h2 className="font-semibold">
          {translate('สร้างชุดโจทย์', 'Create a puzzle set')}
        </h2>
        <p className="text-sm text-secondary">
          {translate(
            'Stockfish คัดโจทย์รุกฆาตและชนะหมากจากรีวิวในเครื่องและเกมล่าสุดในคลัง',
            'Stockfish finds checkmate and material-winning puzzles in local reviews and recent library games.',
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">
            {translate('ฝึกฝ่าย', 'Practice as')}{' '}
            <select
              className="control"
              value={side}
              disabled={!!progress}
              onChange={(event) => setSide(event.target.value)}
            >
              <option value="both">
                {translate('ทั้งสองฝ่าย', 'Both sides')}
              </option>
              <option value="w">{translate('ขาว', 'White')}</option>
              <option value="b">{translate('ดำ', 'Black')}</option>
            </select>
          </label>
          <button
            className="control primary-control"
            disabled={!!progress}
            onClick={() => void generate()}
          >
            {translate('สร้างโจทย์', 'Generate puzzles')}
          </button>
          {progress && (
            <button className="control" onClick={() => active.current?.abort()}>
              {translate('หยุด', 'Stop')}
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
          <p role="status">
            {translate('ฝึกครบ', 'Completed')} {puzzles.length}{' '}
            {translate('ข้อแล้ว', ' puzzles')}
          </p>
          <button className="control" onClick={() => setIndex(0)}>
            {translate('ฝึกชุดนี้อีกครั้ง', 'Practice this set again')}
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
      aria-label={translate('กระดานโจทย์', 'Puzzle board')}
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
          {translate('ข้อ', 'Puzzle')} {number} / {total} ·{' '}
          {puzzleThemes[puzzle.theme]}
        </h2>
        <p role="status">
          {state === 'start'
            ? translate('หาตาที่ดีที่สุดของฝ่าย', 'Find the best move for') +
              (game.turn() === 'w'
                ? translate('ขาว', 'White')
                : translate('ดำ', 'Black'))
            : state === 'retry'
              ? translate('ลองอีกครั้ง', 'Try again')
              : (state === 'solved'
                  ? translate('ถูกต้อง · ', 'Correct · ')
                  : translate('เฉลย · ', 'Solution · ')) + puzzle.san}
        </p>
        <div className="flex flex-wrap gap-2">
          {done ? (
            <>
              <button className="control primary-control" onClick={onNext}>
                {number === total
                  ? translate('จบชุดฝึก', 'Finish practice')
                  : translate('ข้อถัดไป', 'Next puzzle')}
              </button>
              <button
                className="control"
                aria-expanded={showSource}
                onClick={onSource}
              >
                {showSource
                  ? translate('ซ่อนเกมต้นฉบับ', 'Hide original game')
                  : translate('เปิดเกมต้นฉบับ', 'Open original game')}
              </button>
            </>
          ) : (
            <button className="control" onClick={() => setState('reveal')}>
              {translate('ดูเฉลย', 'Show solution')}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
