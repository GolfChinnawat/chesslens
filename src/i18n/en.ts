import type { th } from './th'

export const en: Record<keyof typeof th, string> = {
  title: 'Stockfish smoke test',
  play: 'Back to the board',
  description:
    'Check that the WebAssembly chess engine starts in the browser and finds a move from the starting position.',
  depth: 'Search depth',
  ready: 'Ready to test',
  running: 'Stockfish is searching…',
  success: 'The engine returned a result',
  error: 'The test failed',
  failed:
    'Stockfish could not start. Check that the engine assets loaded and try again.',
  timeout: 'Stockfish timed out. Try again.',
  noMove: 'Stockfish did not return a move from the starting position.',
  run: 'Test engine',
  rerun: 'Run again',
}
