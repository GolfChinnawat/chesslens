import { Chess } from 'chess.js'
import type { GameReview, ReviewScore } from '../types/review'
import type { MoveGrade } from './classify'

const pieceNames = {
  p: 'เบี้ย',
  n: 'ม้า',
  b: 'บิชอป',
  r: 'เรือ',
  q: 'ควีน',
  k: 'คิง',
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
    ? 'ผลวิเคราะห์นี้ไม่มีแนวแนะนำก่อนเดิน'
    : best.uci === move.uci
      ? 'Stockfish แนะนำตานี้เช่นกัน'
      : 'Stockfish แนะนำ ' + best.san
  const reply = after.lines[0]?.moves[0]
  let reason =
    'โอกาสชนะโดยประมาณ ' +
    grade.winBefore.toFixed(1) +
    '% → ' +
    grade.winAfter.toFixed(1) +
    '% จากมุมของฝ่ายที่เดิน'
  let lesson = 'ลองเทียบแนวที่เดินจริงกับแนวแนะนำ แล้วดูว่าคู่แข่งตอบอะไรได้บ้าง'

  if (grade.kind === 'forced') {
    reason = 'ตำแหน่งนี้มีตาที่เดินถูกกติกาเพียงตาเดียว'
    lesson = 'ดูว่าคิงมีช่องหนีหรือมีหมากตัวไหนช่วยแก้เช็กได้'
  } else if (grade.kind === 'book') {
    reason = move.san + ' ตรงกับแนวเปิดเกมในฐานข้อมูลของ ChessLens'
    lesson = 'ลองดูว่าตานี้ช่วยพัฒนาหมากหรือคุมช่องไหน'
  } else if (winningMate(after.score, move.color) && after.score.value === 0) {
    reason = move.san + ' รุกฆาตและจบเกม'
    lesson = 'ลองดูว่าหมากตัวไหนคุมช่องหนีของคิงคู่แข่ง'
  } else if (
    winningMate(after.score, opponent) &&
    !winningMate(before.score, opponent)
  ) {
    reason = 'หลังเดินตานี้ Stockfish พบแนวรุกฆาตให้คู่แข่ง'
    lesson = 'ก่อนเดิน ลองดูตาเช็กของคู่แข่งและช่องหนีของคิง'
  } else if (
    winningMate(before.lines[0]?.score ?? before.score, move.color) &&
    !winningMate(after.score, move.color)
  ) {
    reason = 'ตานี้พลาดแนวรุกฆาตที่ Stockfish พบก่อนเดิน'
    lesson = 'เมื่อคิงคู่แข่งมีช่องหนีน้อย ให้ไล่ดูตาเช็กก่อน'
  } else if (reply && grade.loss >= 5) {
    try {
      const response = new Chess(review.positions[ply].fen).move(reply.uci)
      if (response.captured) {
        reason =
          'หลังเดินตานี้ แนวของ Stockfish ให้คู่แข่งตอบ ' +
          response.san +
          ' ซึ่งกิน' +
          pieceNames[response.captured]
        lesson = 'ก่อนเดิน ลองมองทั้งตากินของคู่แข่งและหมากที่เหลือตัวป้องกันน้อยลง'
      }
    } catch {
      // Cached reviews can lack a usable reply. Keep the evaluation explanation.
    }
  }

  return { reason, recommendation, lesson }
}
