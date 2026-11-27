import { SiteNav } from '../components/SiteNav'
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
    <main className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-8 sm:py-6">
      <header className="mb-8"><SiteNav current="smoke" /></header>
      <section className="mx-auto w-full max-w-2xl" aria-labelledby="page-title">
        <h1 id="page-title" className="text-3xl font-semibold sm:text-5xl">
          {messages.title}
        </h1>
        <p className="mt-4 max-w-lg leading-relaxed text-secondary">
          {messages.description}
        </p>
        <div className="mt-8 rounded-xl border border-line bg-surface p-5 sm:p-7">
          <p className="text-sm text-secondary">
            {messages.depth}{' '}
            <span className="font-mono text-white">{smokeDepth}</span>
          </p>
          <div role="status" className="mt-4 min-h-16">
            <p>{messages[result.status]}</p>
            {result.status === 'success' && (
              <code className="mt-2 block break-words text-accent">
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
            className="control primary-control mt-4 w-full sm:w-auto"
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
