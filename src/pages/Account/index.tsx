import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { cloud } from '../../lib/cloud'
import { Library } from './Library'

export default function AccountPage() {
  const [session, setSession] = useState<Session | null>()
  const [signup, setSignup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const subscription = cloud?.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    )
    return () => subscription?.data.subscription.unsubscribe()
  }, [])

  function redirectUrl() {
    return new URL('?view=account', window.location.href).href
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cloud || busy) return
    const form = new FormData(event.currentTarget)
    const credentials = {
      email: String(form.get('email')),
      password: String(form.get('password')),
    }
    setMessage('')
    setBusy(true)
    try {
      const response = signup
        ? await cloud.auth.signUp({
            ...credentials,
            options: { emailRedirectTo: redirectUrl() },
          })
        : await cloud.auth.signInWithPassword(credentials)
      if (response.error) throw response.error
      if (signup && !response.data.session) setMessage('ตรวจอีเมลเพื่อยืนยันบัญชี')
    } catch {
      setMessage(
        signup
          ? 'สมัครสมาชิกไม่สำเร็จ กรุณาลองอีกครั้ง'
          : 'เข้าสู่ระบบไม่ได้ ตรวจอีเมลและรหัสผ่าน',
      )
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    if (!cloud || busy) return
    setBusy(true)
    try {
      const { error } = await cloud.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl() },
      })
      if (error) throw error
    } catch {
      setMessage('เข้าสู่ระบบด้วย Google ไม่สำเร็จ')
      setBusy(false)
    }
  }
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <header className="space-y-3 mb-4">
        <h1 className="text-2xl font-semibold sm:text-3xl">บัญชี ChessLens</h1>
      </header>
      {!cloud ? (
        <p className="panel">คลังเกมออนไลน์ยังไม่ได้เชื่อมต่อกับเซิร์ฟเวอร์</p>
      ) : session === undefined ? (
        <p role="status">กำลังตรวจสอบการเข้าสู่ระบบ…</p>
      ) : session ? (
        <Library key={session.user.id} session={session} />
      ) : (
        <section className="panel max-w-md space-y-3">
          <h2 className="font-semibold">{signup ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</h2>
          <form onSubmit={(event) => void login(event)} className="space-y-3">
            <label className="block">
              อีเมล
              <input
                className="control mt-1 block w-full"
                type="email"
                name="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            <label className="block">
              รหัสผ่าน
              <input
                className="control mt-1 block w-full"
                type="password"
                name="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                minLength={signup ? 8 : undefined}
                required
                maxLength={72}
              />
            </label>
            <button className="control primary-control" disabled={busy}>
              {signup ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
            <button
              className="control"
              disabled={busy}
              onClick={() => {
                setSignup(!signup)
                setMessage('')
              }}
            >
              {signup ? 'กลับไปเข้าสู่ระบบ' : 'สร้างบัญชีใหม่'}
            </button>
            <button
              className="control"
              disabled={busy}
              onClick={() => void google()}
            >
              เข้าสู่ระบบด้วย Google
            </button>
          </div>
          {message && <p role="status">{message}</p>}
        </section>
      )}
    </main>
  )
}
