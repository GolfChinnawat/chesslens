import { copyFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const upstream = resolve('node_modules/stockfish')
const output = resolve('public/stockfish')
const engine = 'stockfish-17.1-lite-single-03e3232'

await mkdir(output, { recursive: true })
await Promise.all([
  copyFile(
    resolve(upstream, 'src', engine + '.js'),
    resolve(output, engine + '.js'),
  ),
  copyFile(
    resolve(upstream, 'src', engine + '.wasm'),
    resolve(output, engine + '.wasm'),
  ),
  copyFile(resolve(upstream, 'Copying.txt'), resolve(output, 'Copying.txt')),
  copyFile(resolve('LICENSE'), resolve(output, 'LICENSE.txt')),
])
