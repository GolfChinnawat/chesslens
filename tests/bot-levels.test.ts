import { expect, it } from 'vitest'
import { botLevels, getBotLevel, isBotLevel } from '../src/engine/bot-levels'

it('maps all eight levels to ordered and supported Stockfish settings', () => {
  expect(botLevels.map(({ level }) => level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  for (const [index, settings] of botLevels.entries()) {
    expect(isBotLevel(settings.level)).toBe(true)
    expect(getBotLevel(settings.level)).toBe(settings)
    expect(settings.skill).toBeGreaterThanOrEqual(0)
    expect(settings.skill).toBeLessThanOrEqual(20)
    expect(settings.depth).toBeGreaterThan(0)
    expect(settings.movetime).toBeGreaterThan(0)
    const previous = botLevels[index - 1]
    if (previous) {
      expect(settings.skill).toBeGreaterThan(previous.skill)
      expect(settings.depth).toBeGreaterThan(previous.depth)
      expect(settings.movetime).toBeGreaterThan(previous.movetime)
    }
  }
  expect(isBotLevel('4')).toBe(false)
  expect(isBotLevel(9)).toBe(false)
})
