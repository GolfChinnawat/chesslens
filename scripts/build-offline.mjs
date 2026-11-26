import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'

const directories = ['assets', 'icons', 'stockfish']
const assets = ['index.html', 'manifest.webmanifest']
for (const directory of directories) {
  for (const entry of await readdir('dist/' + directory, {
    withFileTypes: true,
  })) {
    if (entry.isFile()) assets.push(directory + '/' + entry.name)
  }
}
assets.sort()

const worker = await readFile('src/pwa/sw.js', 'utf8')
const hash = createHash('sha256').update(worker)
for (const asset of assets) {
  hash.update(asset)
  hash.update(await readFile('dist/' + asset))
}

await writeFile(
  'dist/sw.js',
  'const version = ' +
    JSON.stringify(hash.digest('hex').slice(0, 16)) +
    '\nconst assets = ' +
    JSON.stringify(assets) +
    '\n\n' +
    worker,
)
