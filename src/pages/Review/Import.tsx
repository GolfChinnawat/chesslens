import { translate } from '../../i18n/locale'
import { PublicImport } from './PublicImport'
import { useState } from 'react'
import { importGames } from '../../analysis/pgn'
import { reviewText as t } from '../../i18n/review-th'
import { useGameStore } from '../../store'
import { gamePgn } from '../../lib/game'
import {
  reviewDepths,
  type GameReview,
  type ImportedGame,
  type ReviewDepth,
} from '../../types/review'

type Props = {
  initialPgn?: string
  busy: boolean
  cached: GameReview | null
  onRestore: () => void
  onAnalyze: (game: ImportedGame, depth: ReviewDepth, multiPV: number) => void
}

const maxPgnSize = 2 * 1024 * 1024

export function Import({
  initialPgn = '',
  busy,
  cached,
  onRestore,
  onAnalyze,
}: Props) {
  const [input, setInput] = useState(initialPgn)
  const [games, setGames] = useState<ImportedGame[]>([])
  const [selected, setSelected] = useState(0)
  const [depth, setDepth] = useState<ReviewDepth>(16)
  const [multiPV, setMultiPV] = useState(3)
  const [error, setError] = useState('')

  const [filter, setFilter] = useState('')

  function load(value: string, username?: string) {
    try {
      if (value.length > maxPgnSize) throw new Error('PGN too large')
      setGames(importGames(value).map((game) => ({ ...game, username })))
      setFilter('')
      setSelected(0)
      setError('')
    } catch {
      setGames([])
      setError(t.invalid)
    }
  }

  async function fileUpload(file: File) {
    if (!file.name.toLowerCase().endsWith('.pgn') || file.size > maxPgnSize) {
      setError(t.badFile)
      return
    }
    try {
      const value = await file.text()
      setInput(value)
      load(value)
    } catch {
      setError(t.invalid)
    }
  }

  return (
    <>
      {!busy && (
        <PublicImport
          onLoad={(value, username) => {
            setInput('')
            load(value, username)
          }}
        />
      )}
      <section className="panel max-w-3xl">
        <fieldset disabled={busy} className="space-y-4">
          <legend className="mb-3 font-semibold">{t.load}</legend>
          <label className="block text-sm">
            {t.pgn}
            <textarea
              className="mt-1 block w-full rounded-md border border-edge bg-canvas p-3 font-mono"
              value={input}
              rows={5}
              maxLength={maxPgnSize}
              onChange={(event) => {
                setInput(event.target.value)
                setGames([])
                setError('')
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="control" onClick={() => load(input)}>
              {t.load}
            </button>
            <button
              className="control"
              onClick={() => {
                const { game, player, outcome } = useGameStore.getState()
                const pgn = gamePgn(game, player, outcome)
                setInput(pgn)
                load(pgn)
              }}
            >
              {t.recent}
            </button>
            {cached && (
              <button className="control" onClick={onRestore}>
                {t.restore}
              </button>
            )}
          </div>
          <label className="block text-sm">
            {t.file}
            <input
              type="file"
              accept=".pgn,application/x-chess-pgn"
              className="mt-1 block max-w-full text-sm file:mr-2 file:rounded file:bg-raised file:px-3 file:py-2"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void fileUpload(file)
                event.currentTarget.value = ''
              }}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-rose-200">
              {error}
            </p>
          )}
          {!!games.length && (
            <div className="flex flex-wrap items-end gap-2">
              {games.length > 1 && (
                <label className="text-sm">
                  {translate('กรองเกม', 'Filter games')}
                  <input
                    className="control mt-1 block w-full"
                    value={filter}
                    onChange={(event) => {
                      const value = event.target.value
                      setFilter(value)
                      setSelected(
                        games.findIndex(({ headers }) =>
                          Object.values(headers).some((item) =>
                            item.toLowerCase().includes(value.toLowerCase()),
                          ),
                        ),
                      )
                    }}
                  />
                </label>
              )}
              <label className="min-w-0 text-sm">
                {t.game}
                <select
                  className="control mt-1 block max-w-full"
                  value={selected}
                  onChange={(event) => setSelected(Number(event.target.value))}
                >
                  {games.map(({ headers }, index) =>
                    !filter ||
                    Object.values(headers).some((item) =>
                      item.toLowerCase().includes(filter.toLowerCase()),
                    ) ? (
                      <option key={index} value={index}>
                        {index + 1}.{' '}
                        {t.players(
                          headers.White ?? t.unknown,
                          headers.Black ?? t.unknown,
                        )}{' '}
                        · {headers.Result ?? t.unknown}
                      </option>
                    ) : null,
                  )}
                </select>
              </label>
              <label className="text-sm">
                {t.depth}
                <select
                  className="control mt-1 block"
                  value={depth}
                  onChange={(event) => {
                    const choice = reviewDepths.find(
                      (item) => item === Number(event.target.value),
                    )
                    if (choice) setDepth(choice)
                  }}
                >
                  {reviewDepths.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                {translate('จำนวนแนวเดิน', 'Number of lines')}
                <select
                  className="control mt-1 block"
                  value={multiPV}
                  onChange={(event) => setMultiPV(Number(event.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((count) => (
                    <option key={count}>{count}</option>
                  ))}
                </select>
              </label>
              <button
                className="control primary-control"
                disabled={!games[selected]}
                onClick={() => onAnalyze(games[selected], depth, multiPV)}
              >
                {t.analyze}
              </button>
              <p className="w-full text-sm text-secondary">
                {[
                  games[selected]?.headers.Date,
                  games[selected]?.headers.TimeControl,
                  games[selected]?.headers.Opening ??
                    games[selected]?.headers.ECO,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          )}
        </fieldset>
      </section>
    </>
  )
}
