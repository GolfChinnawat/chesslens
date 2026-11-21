import { useEffect, useRef, useState } from 'react'

const key = 'chesslens.review.sound'

export function useReviewSound(ply: number, san?: string) {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(key) === 'on'
    } catch {
      return false
    }
  })
  const audio = useRef<AudioContext>()
  const previous = useRef(ply)

  function unlock() {
    try {
      const context = (audio.current ??= new AudioContext())
      if (context.state === 'suspended') void context.resume().catch(() => {})
    } catch {
      // The review works without Web Audio.
    }
  }

  function toggle() {
    if (!enabled) unlock()
    setEnabled(!enabled)
    try {
      localStorage.setItem(key, enabled ? 'off' : 'on')
    } catch {
      /* Optional preference. */
    }
  }

  useEffect(() => {
    if (!enabled) return
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [enabled])

  useEffect(() => {
    const forward = ply === previous.current + 1
    previous.current = ply
    const context = audio.current
    if (!enabled || !forward || !san || context?.state !== 'running') return
    const capture = san.includes('x')
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(capture ? 340 : 690, now)
    oscillator.frequency.exponentialRampToValueAtTime(
      capture ? 105 : 250,
      now + 0.07,
    )
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.095)
  }, [enabled, ply, san])

  useEffect(
    () => () => {
      if (audio.current) void audio.current.close().catch(() => {})
      audio.current = undefined
    },
    [],
  )
  return { enabled, toggle }
}
