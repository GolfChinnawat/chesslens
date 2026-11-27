import { translate } from '../i18n/locale'
import { registerOffline } from './register'
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
    void registerOffline()
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
            {translate('ติดตั้ง ChessLens', 'Install ChessLens')}
          </button>
        )}
        <span className="text-sm text-secondary" role="status">
          {translate('การเชื่อมต่อ:', 'Connection:')}{' '}
          {online
            ? translate('ออนไลน์', 'Online')
            : translate('ออฟไลน์', 'Offline')}
        </span>
      </div>
      <p className="text-sm text-secondary" role="status">
        {ready
          ? translate('พร้อมใช้งานออฟไลน์', 'Ready to use offline')
          : failed
            ? translate(
                'เตรียมออฟไลน์ไม่สำเร็จ ลองเปิดหน้านี้ใหม่',
                'Offline setup failed. Try reloading this page.',
              )
            : translate('กำลังเตรียมใช้งานออฟไลน์…', 'Setting up offline access…')}
      </p>
      {showHelp && (
        <p className="text-sm text-secondary">
          {translate(
            'เลือกติดตั้งแอปจากเมนูเบราว์เซอร์ หรือบน iPhone เปิดด้วย Safari แล้วเลือกแชร์ → เพิ่มไปยังหน้าจอโฮม',
            'Choose Install from the browser menu. On iPhone, open in Safari and choose Share → Add to Home Screen.',
          )}
        </p>
      )}
    </div>
  )
}
