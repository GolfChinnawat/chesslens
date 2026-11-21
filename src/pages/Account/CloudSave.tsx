import { useState } from 'react'
import { cloud, saveCloudReview } from '../../lib/cloud'
import type { GameReview } from '../../types/review'

export function CloudSave({ review }: { review: GameReview }) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  if (!cloud) return null
  async function save() {
    if (!cloud || busy) return
    setBusy(true)
    setStatus('')
    try {
      const { data, error } = await cloud.auth.getSession()
      if (error) throw error
      if (!data.session) {
        setStatus('เข้าสู่ระบบเพื่อบันทึกรีวิว')
        return
      }
      await saveCloudReview(review)
      setStatus('บันทึกในคลังเกมแล้ว')
    } catch {
      setStatus('บันทึกไม่ได้ กรุณาลองอีกครั้ง')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button className="control" disabled={busy} onClick={() => void save()}>
        บันทึกเข้าคลังเกม
      </button>
      {status && (
        <span className="self-center text-sm" role="status">
          {status}
        </span>
      )}
    </>
  )
}
