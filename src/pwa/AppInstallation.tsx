import { useEffect, useState } from 'react'

type InstallEvent = Event & {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function AppInstallation() {
  const [prompt, setPrompt] = useState<InstallEvent>()
  const [online, setOnline] = useState(() => navigator.onLine)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const installed = window.matchMedia('(display-mode: standalone)').matches

  useEffect(() => {
    function updateConnection() {
      setOnline(navigator.onLine)
    }
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    updateConnection()
    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    function offer(event: Event) {
      event.preventDefault()
      setPrompt(event as InstallEvent)
    }
    function clearPrompt() {
      setPrompt(undefined)
      setShowHelp(false)
    }
    window.addEventListener('beforeinstallprompt', offer)
    window.addEventListener('appinstalled', clearPrompt)
    const worker = new URL(import.meta.env.BASE_URL + 'sw.js', document.baseURI)
    void navigator.serviceWorker
      .register(worker)
      .then((registration) => {
        const current = registration.installing
        current?.addEventListener('statechange', () => {
          if (current.state === 'redundant' && !registration.active)
            setFailed(true)
        })
        return navigator.serviceWorker.ready
      })
      .then(() => setReady(true))
      .catch(() => setFailed(true))

    return () => {
      window.removeEventListener('beforeinstallprompt', offer)
      window.removeEventListener('appinstalled', clearPrompt)
    }
  }, [])

  if (!('serviceWorker' in navigator)) return null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {!installed && (
          <button
            type="button"
            className="control"
            onClick={() => {
              if (!prompt) {
                setShowHelp(!showHelp)
                return
              }
              setPrompt(undefined)
              void prompt.prompt().catch(() => setShowHelp(true))
            }}
          >
            ติดตั้ง ChessLens
          </button>
        )}
        <span className="text-sm text-secondary" role="status">
          การเชื่อมต่อ: {online ? 'ออนไลน์' : 'ออฟไลน์'}
        </span>
      </div>
      <p className="text-sm text-secondary" role="status">
        {ready
          ? 'พร้อมใช้งานออฟไลน์'
          : failed
            ? 'เตรียมออฟไลน์ไม่สำเร็จ ลองเปิดหน้านี้ใหม่'
            : 'กำลังเตรียมใช้งานออฟไลน์…'}
      </p>
      {showHelp && (
        <p className="text-sm text-secondary">
          เลือกติดตั้งแอปจากเมนูเบราว์เซอร์ หรือบน iPhone เปิดด้วย Safari แล้วเลือกแชร์ →
          เพิ่มไปยังหน้าจอโฮม
        </p>
      )}
    </div>
  )
}
