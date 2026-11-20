import { Chess } from 'chess.js'
import { parseBestmove, parseInfo, type UciInfo } from './uci'

type SearchSettings = {
  depth?: number
  movetime?: number
  multiPV?: number
  signal?: AbortSignal
  cache?: boolean
  moves?: string[]
}
type SearchResult = NonNullable<ReturnType<typeof parseBestmove>> & {
  lines: UciInfo[]
}
type Pending = {
  reject: (error: unknown) => void
  receive: (line: string) => void
}

const abortError = () => new DOMException('Search cancelled', 'AbortError')
const cacheLimit = 96

export class StockfishEngine {
  private worker?: Worker
  private pending?: Pending
  private queue: Promise<unknown> = Promise.resolve()
  private search?: AbortController
  private closed = false
  private readonly options = new Map<string, string | number | boolean>()
  private readonly cache = new Map<string, SearchResult>()

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(() => {
      if (this.closed) throw abortError()
      return operation()
    })
    this.queue = next.catch(() => undefined)
    return next
  }

  private reset(error: unknown) {
    this.worker?.terminate()
    this.worker = undefined
    this.pending?.reject(error)
  }

  private async connect() {
    if (this.worker) return
    const asset =
      import.meta.env.BASE_URL +
      'stockfish/stockfish-17.1-lite-single-03e3232.js'
    const worker = new Worker(new URL(asset, document.baseURI))
    this.worker = worker
    const fail = () => {
      if (this.worker === worker)
        this.reset(new Error('Stockfish worker failed'))
    }
    worker.onerror = fail
    worker.onmessageerror = fail
    worker.onmessage = ({ data }: MessageEvent<unknown>) => {
      if (this.worker !== worker || typeof data !== 'string') return
      for (const line of data.split(/\r?\n/)) this.pending?.receive(line.trim())
    }

    await this.wait(['uci'], (line) => line === 'uciok' || undefined)
    const commands = [...this.options].map(
      ([name, value]) => `setoption name ${name} value ${value}`,
    )
    await this.wait(
      [...commands, 'isready'],
      (line) => line === 'readyok' || undefined,
    )
  }

  private wait<T>(
    commands: string[],
    read: (line: string) => T | undefined,
    signal?: AbortSignal,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      signal?.throwIfAborted()
      const worker = this.worker
      if (!worker) throw new Error('Stockfish worker unavailable')
      let timer: ReturnType<typeof setTimeout>

      const timeout = () => this.reset(new Error('Stockfish did not respond'))
      const stop = () => {
        clearTimeout(timer)
        timer = setTimeout(timeout, 3_000)
        worker.postMessage('stop')
      }
      const clean = () => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', stop)
        this.pending = undefined
      }
      timer = setTimeout(timeout, 30_000)
      signal?.addEventListener('abort', stop, { once: true })
      this.pending = {
        reject: (error) => {
          clean()
          reject(signal?.aborted ? signal.reason : error)
        },
        receive: (line) => {
          const result = read(line)
          if (result === undefined) return
          clean()
          if (signal?.aborted) reject(signal.reason)
          else resolve(result)
        },
      }
      for (const command of commands) worker.postMessage(command)
    })
  }

  init() {
    return this.enqueue(() => this.connect())
  }

  setOption(name: string, value: string | number | boolean) {
    return this.enqueue(async () => {
      if (!name.trim() || /[\r\n]/.test(name + value))
        throw new Error('Invalid UCI option')
      await this.connect()
      await this.wait(
        [`setoption name ${name} value ${value}`, 'isready'],
        (line) => line === 'readyok' || undefined,
      )
      this.options.set(name, value)
    })
  }

  newGame() {
    this.search?.abort(abortError())
    return this.enqueue(async () => {
      await this.connect()
      await this.wait(
        ['ucinewgame', 'isready'],
        (line) => line === 'readyok' || undefined,
      )
    })
  }

  analyze(fen: string, settings: SearchSettings = {}): Promise<SearchResult> {
    this.search?.abort(abortError())
    const request = new AbortController()
    this.search = request
    const signal = settings.signal
      ? AbortSignal.any([request.signal, settings.signal])
      : request.signal

    return this.enqueue(async () => {
      signal.throwIfAborted()
      const {
        depth = settings.movetime === undefined ? 10 : undefined,
        movetime,
        multiPV = 1,
        moves = [],
      } = settings
      for (const [value, maximum] of [
        [depth, 128],
        [movetime, 20_000],
        [multiPV, 256],
      ] as const) {
        if (
          value !== undefined &&
          (!Number.isInteger(value) || value < 1 || value > maximum)
        ) {
          throw new Error('Invalid search settings')
        }
      }
      const position = new Chess(fen)
      const normalizedFen = position.fen()
      for (const move of moves) {
        if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))
          throw new Error('Invalid UCI move')
        position.move(move)
      }
      const key = JSON.stringify([
        normalizedFen,
        moves,
        depth,
        movetime,
        multiPV,
        [...this.options].sort(),
      ])
      const cached = settings.cache === false ? undefined : this.cache.get(key)
      if (cached) {
        this.cache.delete(key)
        this.cache.set(key, cached)
        return structuredClone(cached)
      }

      await this.connect()
      await this.wait(
        [`setoption name MultiPV value ${multiPV}`, 'isready'],
        (line) => line === 'readyok' || undefined,
      )
      const lines = new Map<number, UciInfo>()
      const go = [
        'go',
        depth && `depth ${depth}`,
        movetime && `movetime ${movetime}`,
      ]
        .filter(Boolean)
        .join(' ')
      const moveList = moves.length ? ` moves ${moves.join(' ')}` : ''
      const result = await this.wait(
        [`position fen ${normalizedFen}${moveList}`, go],
        (line) => {
          const best = parseBestmove(line)
          if (best)
            return {
              ...best,
              lines: [...lines.values()].sort(
                (a, b) => (a.multipv ?? 1) - (b.multipv ?? 1),
              ),
            }
          const info = parseInfo(line)
          if (info?.score && info.pv) lines.set(info.multipv ?? 1, info)
        },
        signal,
      )
      if (settings.cache !== false) {
        this.cache.set(key, structuredClone(result))
        if (this.cache.size > cacheLimit)
          this.cache.delete(this.cache.keys().next().value!)
      }
      return result
    }).finally(() => {
      if (this.search === request) this.search = undefined
    })
  }

  async stop() {
    this.search?.abort(abortError())
    await this.queue
  }

  destroy() {
    this.closed = true
    this.search?.abort(abortError())
    this.reset(abortError())
    this.cache.clear()
  }
}
