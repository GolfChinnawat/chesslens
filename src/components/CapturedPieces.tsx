import type { Color, PieceSymbol } from 'chess.js'
import { playMessages as text } from '../i18n'
import { translate } from '../i18n/locale'
import { opponent } from '../lib/game'

const glyphs: Record<Color, Record<PieceSymbol, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
}

const colors = ['w', 'b'] as const
const names = {
  p: translate('เบี้ย', 'Pawn'),
  n: text.knight,
  b: text.bishop,
  r: text.rook,
  q: text.queen,
  k: translate('คิง', 'King'),
}

export function CapturedPieces({
  captures,
}: {
  captures: Record<Color, PieceSymbol[]>
}) {
  return (
    <section aria-label={text.captured} className="border-t border-line pt-2">
      <p className="text-sm font-semibold">{text.captured}</p>
      <div className="grid grid-cols-2 gap-2">
        {colors.map((color) => {
          const pieces = [...new Set(captures[color])]
          return (
            <div key={color} className="min-w-0 text-sm text-secondary">
              <span className="block">
                {color === 'w'
                  ? translate('ฝ่ายขาวกิน', 'Captured by White')
                  : translate('ฝ่ายดำกิน', 'Captured by Black')}
              </span>
              <span className="flex min-h-6 flex-wrap items-center gap-x-2 text-foreground">
                {pieces.length === 0
                  ? text.none
                  : pieces.map((piece) => {
                      const count = captures[color].filter(
                        (item) => item === piece,
                      ).length
                      return (
                        <span
                          key={piece}
                          role="img"
                          aria-label={`${names[piece]} × ${count}`}
                          title={`${names[piece]} × ${count}`}
                          className="whitespace-nowrap"
                        >
                          <span aria-hidden="true">
                            <span className="text-lg">
                              {glyphs[opponent(color)][piece]}
                            </span>
                            {count > 1 && ` ×${count}`}
                          </span>
                        </span>
                      )
                    })}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
