import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface Props {
  onDelete: () => void
  className?: string
}

/** Drop-in replacement for bare delete icon buttons.
 *  First tap → shows "Delete? Yes / No" inline.
 *  Second tap on "Yes" → calls onDelete.
 *  Auto-resets after 3 s if not confirmed.
 */
export function DeleteButton({ onDelete, className }: Props) {
  const [confirming, setConfirming] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startConfirm = () => {
    setConfirming(true)
    timerRef.current = setTimeout(() => setConfirming(false), 3000)
  }

  const cancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setConfirming(false)
  }

  const confirm = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setConfirming(false)
    onDelete()
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={confirm}
          className="text-xs font-semibold text-red-400 hover:text-red-300 active:scale-95 transition-all px-1.5 py-0.5 rounded"
        >
          Delete
        </button>
        <button
          onClick={cancel}
          className="text-xs text-gray-500 hover:text-gray-300 active:scale-95 transition-all px-1.5 py-0.5 rounded"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button onClick={startConfirm} className={className}>
      <X size={15} />
    </button>
  )
}
