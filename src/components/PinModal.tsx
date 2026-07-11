import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { Delete } from 'lucide-react'
import { getProfilePinHash, setProfilePin, verifyPin, clearProfilePin, verifyMasterPin } from '../lib/auth'
import type { ProfileId } from '../types'

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const
const PIN_LENGTH = 4
const MASTER_PIN_LENGTH = 6

const PROFILE_NAMES: Record<string, string> = {
  mine: 'Bao Yob 🦅',
  hers: 'Bao 🐥',
  shared: 'Family',
  travels: 'Travels',
}

interface Props {
  profileId: ProfileId
  onSuccess: () => void
  onCancel: () => void
}

type Step = 'loading' | 'setup-enter' | 'setup-confirm' | 'verify' | 'master'

export function PinModal({ profileId, onSuccess, onCancel }: Props) {
  const [step, setStep] = useState<Step>('loading')
  const [pinDisplay, setPinDisplay] = useState(0)
  const [masterDisplay, setMasterDisplay] = useState(0)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  const pinRef = useRef('')
  const masterPinRef = useRef('')
  const stepRef = useRef<Step>('loading')
  const firstPinRef = useRef('')
  const processingRef = useRef(false)

  const syncStep = (s: Step) => { stepRef.current = s; setStep(s) }

  useEffect(() => {
    getProfilePinHash(profileId).then(hash => {
      syncStep(hash ? 'verify' : 'setup-enter')
    })
  }, [profileId])

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const resetPin = () => { pinRef.current = ''; setPinDisplay(0) }
  const resetMaster = () => { masterPinRef.current = ''; setMasterDisplay(0) }

  const handleKey = async (key: string) => {
    setError('')

    // Backspace
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

    // Master PIN flow (6-digit, verified server-side)
    if (stepRef.current === 'master') {
      if (processingRef.current) return
      if (masterPinRef.current.length >= MASTER_PIN_LENGTH) return
      masterPinRef.current += key
      setMasterDisplay(masterPinRef.current.length)
      if (masterPinRef.current.length < MASTER_PIN_LENGTH) return
      processingRef.current = true
      const ok = await verifyMasterPin(masterPinRef.current)
      if (ok) {
        await clearProfilePin(profileId)
        processingRef.current = false
        resetMaster()
        firstPinRef.current = ''
        syncStep('setup-enter')
      } else {
        processingRef.current = false
        setError('Wrong master PIN.')
        triggerShake()
        setTimeout(() => resetMaster(), 400)
      }
      return
    }

    // Normal 4-digit PIN flow
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
        await setProfilePin(profileId, completed)
        processingRef.current = false
        onSuccess()
      }

    } else if (stepRef.current === 'verify') {
      const ok = await verifyPin(profileId, completed)
      processingRef.current = false
      if (ok) {
        onSuccess()
      } else {
        setError('Wrong PIN. Try again.')
        triggerShake()
        setTimeout(() => resetPin(), 400)
      }
    }
  }

  // Keep a stable ref to the latest handleKey for keyboard listener
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col items-center gap-6">

        {step === 'loading' ? (
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <div className="text-center">
              <p className="text-gray-400 text-sm">{PROFILE_NAMES[profileId] ?? profileId}</p>
              <h2 className="text-xl font-semibold text-white mt-1">{title}</h2>
              {step === 'setup-enter' && <p className="text-gray-500 text-sm mt-1">Choose a 4-digit PIN</p>}
              {step === 'master' && <p className="text-gray-500 text-sm mt-1">Enter 6-digit master PIN to reset</p>}
            </div>

            {/* Dots */}
            <div className={`flex gap-4 ${shake ? 'animate-bounce' : ''}`}>
              {Array.from({ length: currentDots }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                    i < currentFilled ? 'bg-white border-transparent' : 'bg-transparent border-gray-600'
                  }`}
                />
              ))}
            </div>

            {error && <p className="text-red-400 text-sm -mt-2">{error}</p>}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
              {KEYPAD.map((key, i) => {
                if (key === '') return <div key={i} />
                return (
                  <button
                    key={i}
                    onClick={() => { void handleKey(key) }}
                    className={`h-14 rounded-xl font-semibold text-xl transition-all duration-100 ${
                      key === '⌫'
                        ? 'text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/20'
                        : 'bg-white/5 border border-border text-white hover:bg-white/10 active:scale-95 active:bg-white/20'
                    }`}
                  >
                    {key === '⌫' ? <Delete size={18} className="mx-auto" /> : key}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col items-center gap-2">
              {step === 'verify' && (
                <button
                  onClick={() => { resetPin(); resetMaster(); syncStep('master'); setError('') }}
                  className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
                >
                  Forgot PIN?
                </button>
              )}
              {step === 'master' && (
                <button
                  onClick={() => { resetMaster(); syncStep('verify'); setError('') }}
                  className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
                >
                  Back
                </button>
              )}
              <button onClick={onCancel} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
