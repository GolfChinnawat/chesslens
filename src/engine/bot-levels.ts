// Depth and time cap each move. Skill applies Stockfish's built-in weakening.
// Levels are relative strengths, with no Elo calibration.
export const botLevels = [
  { level: 1, skill: 0, depth: 3, movetime: 100 },
  { level: 2, skill: 2, depth: 4, movetime: 140 },
  { level: 3, skill: 4, depth: 5, movetime: 200 },
  { level: 4, skill: 7, depth: 6, movetime: 280 },
  { level: 5, skill: 10, depth: 8, movetime: 400 },
  { level: 6, skill: 13, depth: 10, movetime: 650 },
  { level: 7, skill: 16, depth: 12, movetime: 950 },
  { level: 8, skill: 20, depth: 15, movetime: 1500 },
] as const

export type BotLevel = (typeof botLevels)[number]['level']

export function isBotLevel(value: unknown): value is BotLevel {
  return botLevels.some(({ level }) => level === value)
}

export function getBotLevel(level: BotLevel) {
  return botLevels[level - 1]
}
