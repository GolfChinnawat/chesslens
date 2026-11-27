import { translate } from '../../i18n/locale'
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
        setStatus(translate('เข้าสู่ระบบเพื่อบันทึกรีวิว', 'Sign in to save the review'))
        return
      }
      await saveCloudReview(review)
      setStatus(translate('บันทึกในคลังเกมแล้ว', 'Saved to your game library'))
    } catch {
      setStatus(
        translate('บันทึกไม่ได้ กรุณาลองอีกครั้ง', 'Could not save. Try again.'),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button
        className="control primary-control"
        disabled={busy}
        onClick={() => void save()}
      >
        {translate('บันทึกเข้าคลังเกม', 'Save to game library')}
      </button>
      {status && (
        <span className="self-center text-sm" role="status">
          {status}
        </span>
      )}
    </>
  )
}
