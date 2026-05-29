import { useState, useEffect, useRef } from 'react'
import { Check } from 'lucide-react'

interface Props {
  /** If true the item is already paid — clicking immediately un-marks (no confirmation needed). */
  isPaid?: boolean
  onToggle: () => void
  className?: string
}

/**
 * First tap → shows "Pay · No" confirmation inline (same pattern as DeleteButton).
 * Second tap on "Pay" → executes. Auto-cancels after 3 s.
 * When already paid, toggling back is instant (no confirmation).
 */
export function PaidButton({ isPaid = false, onToggle, className }: Props) {
  const [confirming, setConfirming] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClick = () => {
    if (isPaid) { onToggle(); return }
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
    onToggle()
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={confirm}
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 active:scale-95 transition-all px-1.5 py-0.5 rounded"
        >
          Pay
        </button>
        <button
          onClick={cancel}
          className="text-xs text-gray-500 hover:text-gray-300 active:scale-95 transition-all px-1.5 py-0.5 rounded"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      className={className ?? `p-1 rounded-lg transition-colors ${
        isPaid ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-emerald-400'
      }`}
    >
      <Check size={13} />
    </button>
  )
}
