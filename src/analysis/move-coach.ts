import { translate } from '../i18n/locale'
import { Chess } from 'chess.js'
import type { GameReview, ReviewScore } from '../types/review'
import type { MoveGrade } from './classify'

const pieceNames = {
  p: translate('เบี้ย', 'pawn'),
  n: translate('ม้า', 'knight'),
  b: translate('บิชอป', 'bishop'),
  r: translate('เรือ', 'rook'),
  q: translate('ควีน', 'queen'),
  k: translate('คิง', 'king'),
}

function winningMate(score: ReviewScore | null | undefined, color: 'w' | 'b') {
  return score?.kind === 'mate' && score.winner === color
}

export function explainMove(review: GameReview, ply: number, grade: MoveGrade) {
  const move = review.positions[ply]?.move
  const before = review.evaluations[ply - 1]
  const after = review.evaluations[ply]
  const best = before?.lines[0]?.moves[0]
  if (!move || !after?.score) return

  const opponent = move.color === 'w' ? 'b' : 'w'
  const recommendation = !best
    ? translate(
        'ผลวิเคราะห์นี้ไม่มีแนวแนะนำก่อนเดิน',
        'The engine returned no recommendation before this move.',
      )
    : best.uci === move.uci
      ? translate(
          'Stockfish แนะนำตานี้เช่นกัน',
          'Stockfish also recommends this move.',
        )
      : translate('Stockfish แนะนำ ', 'Stockfish recommends ') + best.san
  const reply = after.lines[0]?.moves[0]
  let reason =
    translate('โอกาสชนะโดยประมาณ ', 'Estimated winning chance: ') +
    grade.winBefore.toFixed(1) +
    '% → ' +
    grade.winAfter.toFixed(1) +
    translate('% จากมุมของฝ่ายที่เดิน', "% from the mover's perspective")
  let lesson = translate(
    'ลองเทียบแนวที่เดินจริงกับแนวแนะนำ แล้วดูว่าคู่แข่งตอบอะไรได้บ้าง',
    'Compare the game move with the recommended line and look at the opponent’s replies.',
  )

  if (grade.kind === 'forced') {
    reason = translate(
      'ตำแหน่งนี้มีตาที่เดินถูกกติกาเพียงตาเดียว',
      'There is only one legal move in this position.',
    )
    lesson = translate(
      'ดูว่าคิงมีช่องหนีหรือมีหมากตัวไหนช่วยแก้เช็กได้',
      'Look for safe squares for the king or another piece that can answer the check.',
    )
  } else if (grade.kind === 'book') {
    reason =
      move.san +
      translate(
        ' ตรงกับแนวเปิดเกมในฐานข้อมูลของ ChessLens',
        ' follows an opening line in the ChessLens database.',
      )
    lesson = translate(
      'ลองดูว่าตานี้ช่วยพัฒนาหมากหรือคุมช่องไหน',
      'Look at which piece this move develops or which squares it controls.',
    )
  } else if (winningMate(after.score, move.color) && after.score.value === 0) {
    reason = move.san + translate(' รุกฆาตและจบเกม', ' delivers checkmate.')
    lesson = translate(
      'ลองดูว่าหมากตัวไหนคุมช่องหนีของคิงคู่แข่ง',
      'Look at which pieces cover the opposing king’s escape squares.',
    )
  } else if (
    winningMate(after.score, opponent) &&
    !winningMate(before.score, opponent)
  ) {
    reason = translate(
      'หลังเดินตานี้ Stockfish พบแนวรุกฆาตให้คู่แข่ง',
      'After this move, Stockfish found a forced mate for the opponent.',
    )
    lesson = translate(
      'ก่อนเดิน ลองดูตาเช็กของคู่แข่งและช่องหนีของคิง',
      'Before moving, check the opponent’s forcing checks and your king’s escape squares.',
    )
  } else if (
    winningMate(before.lines[0]?.score ?? before.score, move.color) &&
    !winningMate(after.score, move.color)
  ) {
    reason = translate(
      'ตานี้พลาดแนวรุกฆาตที่ Stockfish พบก่อนเดิน',
      'This move missed a forced mate Stockfish found in the previous position.',
    )
    lesson = translate(
      'เมื่อคิงคู่แข่งมีช่องหนีน้อย ให้ไล่ดูตาเช็กก่อน',
      'When the opposing king has few escape squares, look at checks first.',
    )
  } else if (reply && grade.loss >= 5) {
    try {
      const response = new Chess(review.positions[ply].fen).move(reply.uci)
      if (response.captured) {
        reason =
          translate(
            'หลังเดินตานี้ แนวของ Stockfish ให้คู่แข่งตอบ ',
            'After this move, Stockfish gives the opponent ',
          ) +
          response.san +
          translate(' ซึ่งกิน', ', which captures a ') +
          pieceNames[response.captured]
        lesson = translate(
          'ก่อนเดิน ลองมองทั้งตากินของคู่แข่งและหมากที่เหลือตัวป้องกันน้อยลง',
          'Before moving, look at the opponent’s captures and pieces that will have fewer defenders.',
        )
      }
    } catch {
      // Cached reviews can lack a usable reply. Keep the evaluation explanation.
    }
  }

  return { reason, recommendation, lesson }
}
