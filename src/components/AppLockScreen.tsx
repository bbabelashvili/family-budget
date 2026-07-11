import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { Delete } from 'lucide-react'
import { appHasPin, setAppPin, verifyAppPin, verifyMasterPin } from '../lib/auth'

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const
const PIN_LENGTH = 4
const MASTER_PIN_LENGTH = 6

interface Props {
  onUnlock: () => void
}

type Step = 'loading' | 'setup-enter' | 'setup-confirm' | 'verify' | 'master'

export function AppLockScreen({ onUnlock }: Props) {
  const [step, setStep] = useState<Step>('loading')
  const [hasPin, setHasPin] = useState(false)
  const [pinDisplay, setPinDisplay] = useState(0)
  const [masterDisplay, setMasterDisplay] = useState(0)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  const pinRef = useRef('')
  const masterPinRef = useRef('')
  const stepRef = useRef<Step>('loading')
  const firstPinRef = useRef('')
  const enteredMasterRef = useRef('') // retained after master check, to authorize setAppPin
  const processingRef = useRef(false)

  const syncStep = (s: Step) => { stepRef.current = s; setStep(s) }
  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 500) }
  const resetPin = () => { pinRef.current = ''; setPinDisplay(0) }
  const resetMaster = () => { masterPinRef.current = ''; setMasterDisplay(0) }

  // No existing PIN → require master PIN before allowing setup (prevents anyone
  // from walking up and setting their own PIN on first launch).
  useEffect(() => {
    appHasPin().then(exists => {
      setHasPin(exists)
      syncStep(exists ? 'verify' : 'master')
    })
  }, [])

  const handleKey = async (key: string) => {
    setError('')

    if (key === '⌫') {
      if (stepRef.current === 'master') {
        masterPinRef.current = masterPinRef.current.slice(0, -1)
        setMasterDisplay(masterPinRef.current.length)
      } else {
        pinRef.current = pinRef.current.slice(0, -1)
        setPinDisplay(pinRef.current.length)
      }
      return
    }

    if (stepRef.current === 'master') {
      if (processingRef.current) return
      if (masterPinRef.current.length >= MASTER_PIN_LENGTH) return
      masterPinRef.current += key
      setMasterDisplay(masterPinRef.current.length)
      if (masterPinRef.current.length < MASTER_PIN_LENGTH) return
      processingRef.current = true
      const ok = await verifyMasterPin(masterPinRef.current)
      processingRef.current = false
      if (ok) {
        enteredMasterRef.current = masterPinRef.current
        resetMaster()
        firstPinRef.current = ''
        syncStep('setup-enter')
      } else {
        setError('Wrong master PIN.')
        triggerShake()
        setTimeout(() => resetMaster(), 400)
      }
      return
    }

    if (processingRef.current) return
    if (pinRef.current.length >= PIN_LENGTH) return
    pinRef.current += key
    setPinDisplay(pinRef.current.length)
    if (pinRef.current.length < PIN_LENGTH) return

    processingRef.current = true
    const completed = pinRef.current

    if (stepRef.current === 'setup-enter') {
      firstPinRef.current = completed
      resetPin()
      syncStep('setup-confirm')
      processingRef.current = false
    } else if (stepRef.current === 'setup-confirm') {
      if (completed !== firstPinRef.current) {
        setError("PINs don't match. Try again.")
        triggerShake()
        resetPin()
        firstPinRef.current = ''
        syncStep('setup-enter')
        processingRef.current = false
      } else {
        const saved = await setAppPin(completed, enteredMasterRef.current)
        if (!saved) {
          setError('Could not save PIN. Try again.')
          triggerShake()
          resetPin()
          firstPinRef.current = ''
          syncStep('setup-enter')
          processingRef.current = false
          return
        }
        await verifyAppPin(completed) // mint the session token
        enteredMasterRef.current = ''
        processingRef.current = false
        onUnlock()
      }
    } else if (stepRef.current === 'verify') {
      const ok = await verifyAppPin(completed)
      processingRef.current = false
      if (ok) {
        onUnlock()
      } else {
        setError('Wrong PIN. Try again.')
        triggerShake()
        setTimeout(() => resetPin(), 400)
      }
    }
  }

  const handleKeyLatest = useRef(handleKey)
  useLayoutEffect(() => { handleKeyLatest.current = handleKey })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key
      if (k >= '0' && k <= '9') void handleKeyLatest.current(k)
      else if (k === 'Backspace') void handleKeyLatest.current('⌫')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const currentDots = step === 'master' ? MASTER_PIN_LENGTH : PIN_LENGTH
  const currentFilled = step === 'master' ? masterDisplay : pinDisplay
  const title = step === 'setup-enter' ? 'Set up PIN'
    : step === 'setup-confirm' ? 'Confirm PIN'
    : step === 'master' ? 'Master PIN'
    : 'Enter PIN'

  if (step === 'loading') {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ backgroundColor: '#F2F0EF' }}>
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-4 gap-8"
      style={{ backgroundColor: '#F2F0EF' }}
    >
      <div className="text-center">
        <div className="text-4xl mb-2">💰</div>
        <p className="text-gray-400 text-sm">Family Budget</p>
        <h2 className="text-xl font-semibold text-gray-900 mt-1">{title}</h2>
        {step === 'setup-enter' && <p className="text-gray-500 text-sm mt-1">Choose a 4-digit app PIN</p>}
        {step === 'master' && <p className="text-gray-500 text-sm mt-1">{hasPin ? 'Enter 6-digit master PIN to reset' : 'Enter master PIN to set up the app'}</p>}
      </div>

      <div className={`flex gap-4 ${shake ? 'animate-bounce' : ''}`}>
        {Array.from({ length: currentDots }).map((_, i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
              i < currentFilled ? 'bg-gray-800 border-transparent' : 'bg-transparent border-gray-400'
            }`}
          />
        ))}
      </div>

      {error && <p className="text-red-500 text-sm -mt-4">{error}</p>}

      <div className="grid grid-cols-3 gap-3 w-64">
        {KEYPAD.map((key, i) => {
          if (key === '') return <div key={i} />
          return (
            <button
              key={i}
              onClick={() => { void handleKey(key) }}
              className={`h-16 rounded-2xl font-semibold text-xl transition-all duration-100 ${
                key === '⌫'
                  ? 'text-gray-400 hover:text-gray-700 hover:bg-black/5 active:bg-black/10'
                  : 'bg-white/70 border border-black/10 text-gray-900 hover:bg-white active:scale-95'
              }`}
            >
              {key === '⌫' ? <Delete size={20} className="mx-auto" /> : key}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col items-center gap-2">
        {step === 'verify' && (
          <button
            onClick={() => { resetPin(); resetMaster(); syncStep('master'); setError('') }}
            className="text-gray-400 hover:text-gray-600 text-xs transition-colors"
          >
            Forgot PIN?
          </button>
        )}
        {step === 'master' && hasPin && (
          <button
            onClick={() => { resetMaster(); syncStep('verify'); setError('') }}
            className="text-gray-400 hover:text-gray-600 text-xs transition-colors"
          >
            Back
          </button>
        )}
      </div>
    </div>
  )
}
