import { useEffect, useRef, useState } from 'react'
import { runSmokeTest, smokeDepth, SmokeTestError } from '../engine'
import { messages } from '../i18n'

type Result =
  | { status: 'ready' | 'running' }
  | { status: 'success'; move: string }
  | { status: 'error'; message: string }

export function SmokeTestPage() {
  const [result, setResult] = useState<Result>({ status: 'ready' })
  const current = useRef<AbortController | null>(null)
  useEffect(() => () => current.current?.abort(), [])

  async function run() {
    if (current.current) return
    const controller = new AbortController()
    current.current = controller
    setResult({ status: 'running' })
    try {
      const move = await runSmokeTest(controller.signal)
      setResult({ status: 'success', move })
    } catch (error) {
      if (controller.signal.aborted) return
      const key = error instanceof SmokeTestError ? error.reason : 'failed'
      setResult({ status: 'error', message: messages[key] })
    } finally {
      current.current = null
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl items-center px-5 py-12 sm:px-12">
      <section className="w-full" aria-labelledby="page-title">
        <a
          href="./"
          className="mb-4 block text-sm text-cyan-200 underline-offset-4 hover:underline"
        >
          {messages.play}
        </a>
        <p className="mb-5 text-lg font-semibold tracking-tight text-cyan-200">
          ChessLens
        </p>
        <h1 id="page-title" className="text-3xl font-semibold sm:text-5xl">
          {messages.title}
        </h1>
        <p className="mt-4 max-w-lg leading-relaxed text-slate-300">
          {messages.description}
        </p>
        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-5 sm:p-7">
          <p className="text-sm text-slate-300">
            {messages.depth}{' '}
            <span className="font-mono text-white">{smokeDepth}</span>
          </p>
          <div role="status" className="mt-4 min-h-16">
            <p>{messages[result.status]}</p>
            {result.status === 'success' && (
              <code className="mt-2 block break-words text-cyan-200">
                {result.move}
              </code>
            )}
            {result.status === 'error' && (
              <p className="mt-2 text-rose-200">{result.message}</p>
            )}
          </div>
          <button
            type="button"
            disabled={result.status === 'running'}
            onClick={run}
            className="mt-4 min-h-11 w-full rounded-lg bg-cyan-200 px-5 py-2 font-semibold text-slate-950 hover:bg-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200 disabled:opacity-60 sm:w-auto"
          >
            {result.status === 'success' || result.status === 'error'
              ? messages.rerun
              : messages.run}
          </button>
        </div>
      </section>
    </main>
  )
}
