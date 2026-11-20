import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

it('ships the pinned single-thread Worker and a real WebAssembly binary', () => {
  const directory = resolve('public/stockfish')
  const engine = 'stockfish-17.1-lite-single-03e3232'

  expect(existsSync(resolve(directory, engine + '.js'))).toBe(true)
  const wasm = readFileSync(resolve(directory, engine + '.wasm'))
  expect(wasm.subarray(0, 4)).toEqual(Buffer.from([0, 97, 115, 109]))
  expect(existsSync(resolve(directory, 'Copying.txt'))).toBe(true)
})
