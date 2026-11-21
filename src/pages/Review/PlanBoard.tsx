import { createPortal } from 'react-dom'
import { Chess, type Square } from 'chess.js'
import { useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { classificationText as t } from '../../i18n/classification-th'

export function PlanBoard({
  fen,
  flipped,
  controls,
}: {
  fen: string
  flipped: boolean
  controls: HTMLDivElement | null
}) {
  const [positions, setPositions] = useState([{ fen, san: '' }])
  const [selected, setSelected] = useState<Square>()
  const [promotion, setPromotion] = useState<{ from: Square; to: Square }>()
  const [drawing, setDrawing] = useState(0)
  const current = positions[positions.length - 1].fen
  const game = new Chess(current)
  const legal = selected ? game.moves({ square: selected, verbose: true }) : []

  function play(from: Square, to: Square, piece?: string) {
    if (promotion && !piece) return false
    const candidates = game
      .moves({ square: from, verbose: true })
      .filter((move) => move.to === to)
    if (!candidates.length) return false
    if (candidates[0].promotion && !piece) {
      setPromotion({ from, to })
      return false
    }
    const move = candidates.find((item) => item.promotion === piece)
    if (!move) return false
    setPositions((history) => [...history, { fen: move.after, san: move.san }])
    setSelected(undefined)
    setPromotion(undefined)
    return true
  }

  function rewind(reset: boolean) {
    setPositions((history) => history.slice(0, reset ? 1 : -1))
    setSelected(undefined)
    setPromotion(undefined)
    setDrawing((version) => version + 1)
  }

  return (
    <div className="space-y-2">
      <Chessboard
        key={drawing}
        id="plan-board"
        position={current}
        boardOrientation={flipped ? 'black' : 'white'}
        areArrowsAllowed
        customArrowColor="#fbbf24"
        arePiecesDraggable={!promotion}
        isDraggablePiece={({ sourceSquare }) =>
          game.get(sourceSquare)?.color === game.turn()
        }
        showPromotionDialog={false}
        onPieceDrop={(from, to) => play(from, to)}
        onSquareClick={(square) => {
          if (promotion) return
          if (selected && legal.some((move) => move.to === square)) {
            play(selected, square)
          } else {
            setSelected(
              square !== selected && game.get(square)?.color === game.turn()
                ? square
                : undefined,
            )
          }
        }}
        customLightSquareStyle={{ backgroundColor: '#dce8d8' }}
        customDarkSquareStyle={{ backgroundColor: '#56817b' }}
        customSquareStyles={{
          ...Object.fromEntries(
            legal.map((move) => [
              move.to,
              {
                backgroundImage:
                  'radial-gradient(circle, #102a2bbb 20%, transparent 23%)',
              },
            ]),
          ),
          ...(selected
            ? { [selected]: { boxShadow: 'inset 0 0 0 3px #fbbf24' } }
            : {}),
        }}
      />
      {controls &&
        createPortal(
          <div className="space-y-2 px-3 pb-3">
            <p className="text-sm text-slate-300">{t.planHelp}</p>
            {promotion && (
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label={t.promote}
              >
                {(['q', 'r', 'b', 'n'] as const).map((piece) => (
                  <button
                    key={piece}
                    className="control uppercase"
                    onClick={() => play(promotion.from, promotion.to, piece)}
                  >
                    {piece}
                  </button>
                ))}
                <button
                  className="control"
                  onClick={() => setPromotion(undefined)}
                >
                  {t.planCancel}
                </button>
              </div>
            )}
            <p role="status" className="break-words font-mono text-sm">
              {positions.length > 1
                ? positions
                    .slice(1)
                    .map(({ san }) => san)
                    .join(' ')
                : t.planEmpty}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="control"
                disabled={positions.length < 2}
                onClick={() => rewind(false)}
              >
                {t.planUndo}
              </button>
              <button
                className="control"
                disabled={positions.length < 2}
                onClick={() => rewind(true)}
              >
                {t.planReset}
              </button>
              <button
                className="control"
                onClick={() => setDrawing((version) => version + 1)}
              >
                {t.planClear}
              </button>
            </div>
          </div>,
          controls,
        )}
    </div>
  )
}
