import {
  Chess,
  type Chess as Game,
  type Color,
  type PieceSymbol,
  type Square,
} from 'chess.js'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Chessboard } from 'react-chessboard'
import { playMessages as text } from '../i18n'

const promotions = [
  ['q', text.queen, '♛'],
  ['r', text.rook, '♜'],
  ['b', text.bishop, '♝'],
  ['n', text.knight, '♞'],
] as const

type Promotion = { from: Square; to: Square; game: Game }
type Props = {
  game: Game
  fen: string
  orientation: Color
  canMove: boolean
  hint?: { from: Square; to: Square }
  lastMove?: { from: Square; to: Square }
  play: (move: { from: Square; to: Square; promotion?: PieceSymbol }) => boolean
}

export function PlayBoard({
  game,
  fen,
  orientation,
  canMove,
  lastMove,
  hint,
  play,
}: Props) {
  const [selection, setSelection] = useState<{
    square: Square
    game: Game
  } | null>(null)
  const [promotion, setPromotion] = useState<Promotion | null>(null)
  const hintArrows = useMemo<[Square, Square, string][]>(
    () => (hint ? [[hint.from, hint.to, '#97ff12']] : []),
    [hint],
  )
  const dialog = useRef<HTMLDialogElement>(null)
  const selected = canMove && selection?.game === game ? selection.square : null
  const pending = canMove && promotion?.game === game ? promotion : null
  const moves = selected ? game.moves({ square: selected, verbose: true }) : []

  useEffect(() => {
    const element = dialog.current
    if (!pending || !element) return
    element.showModal()
    return () => element.close()
  }, [pending])

  function tryMove(from: Square, to: Square) {
    if (!canMove) return false
    const legal = game
      .moves({ square: from, verbose: true })
      .find((move) => move.to === to)
    if (!legal) return false
    setSelection(null)
    if (legal.promotion) {
      setPromotion({ from, to, game })
      return false // Keep the controlled board in place while choosing.
    }
    return play({ from, to })
  }

  function click(square: Square) {
    if (!canMove) return
    if (selected === square) {
      setSelection(null)
      return
    }
    if (selected && moves.some((move) => move.to === square)) {
      tryMove(selected, square)
      return
    }
    setSelection(
      game.get(square)?.color === game.turn() ? { square, game } : null,
    )
  }

  const styles: Record<string, CSSProperties> = {}
  if (lastMove) {
    for (const square of [lastMove.from, lastMove.to])
      styles[square] = { boxShadow: 'inset 0 0 0 100px #b9df4966' }
  }
  if (selected) styles[selected] = { boxShadow: 'inset 0 0 0 3px #e6ff8e' }
  for (const { to, captured } of moves) {
    styles[to] = {
      ...styles[to],
      backgroundImage: captured
        ? 'radial-gradient(transparent 55%, #102a2bbb 58%, #102a2bbb 69%, transparent 72%)'
        : 'radial-gradient(#102a2bbb 20%, transparent 23%)',
    }
  }
  const shown = new Chess(fen)
  if (shown.isCheck()) {
    const king = shown
      .board()
      .flat()
      .find((piece) => piece?.type === 'k' && piece.color === shown.turn())
    if (king)
      styles[king.square] = {
        ...styles[king.square],
        backgroundColor: '#d95656',
      }
  }

  return (
    <section
      aria-label={text.board}
      className="min-w-0 overflow-hidden rounded-lg border border-line"
    >
      <Chessboard
        position={fen}
        boardOrientation={orientation === 'w' ? 'white' : 'black'}
        arePiecesDraggable={canMove}
        isDraggablePiece={({ sourceSquare }) =>
          game.get(sourceSquare)?.color === game.turn()
        }
        onPieceDrop={tryMove}
        onSquareClick={click}
        customLightSquareStyle={{ backgroundColor: 'var(--board-light)' }}
        customDarkSquareStyle={{ backgroundColor: 'var(--board-dark)' }}
        customSquareStyles={styles}
        customArrows={hintArrows}
        animationDuration={140}
        showPromotionDialog={false}
      />
      <dialog
        ref={dialog}
        aria-labelledby="promotion-title"
        onCancel={(event) => {
          event.preventDefault()
          setPromotion(null)
        }}
        className="m-auto max-w-[calc(100%-2rem)] rounded-xl border border-edge bg-surface p-5 text-foreground backdrop:bg-canvas/80"
      >
        <h2 id="promotion-title" className="font-semibold">
          {text.promotion}
        </h2>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {promotions.map(([piece, label, glyph]) => (
            <button
              key={piece}
              className="control px-2"
              onClick={() => {
                if (pending)
                  play({ from: pending.from, to: pending.to, promotion: piece })
                setPromotion(null)
              }}
            >
              <span aria-hidden="true" className="block text-2xl">
                {glyph}
              </span>
              {label}
            </button>
          ))}
        </div>
        <button className="control mt-4" onClick={() => setPromotion(null)}>
          {text.cancel}
        </button>
      </dialog>
    </section>
  )
}
