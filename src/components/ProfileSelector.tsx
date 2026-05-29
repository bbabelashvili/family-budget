import type { ProfileId } from '../types'

const PROFILES = [
  { id: 'mine' as ProfileId,    label: 'Bao Yob', emoji: '🦅', bg: '#D9D9D9' },
  { id: 'hers' as ProfileId,    label: 'Bao',     emoji: '🐥', bg: '#AA98A9' },
  { id: 'shared' as ProfileId,  label: 'Family',  emoji: '🏠', bg: '#EDE8D0' },
  { id: 'travels' as ProfileId, label: 'Travels', emoji: '✈️', bg: '#BBB791' },
]

interface Props {
  onSelect: (id: ProfileId) => void
}

export function ProfileSelector({ onSelect }: Props) {
  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center gap-10 px-4"
      style={{ backgroundColor: '#F2F0EF' }}
    >
      <div className="text-center">
        <div className="text-4xl mb-2">💰</div>
        <h1 className="text-2xl font-bold text-gray-900">Family Budget</h1>
        <p className="text-gray-500 text-sm mt-1">Choose your profile</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 w-full max-w-lg">
        {PROFILES.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="flex flex-col items-center gap-3 transition-all duration-200 hover:scale-[1.06] active:scale-[0.97]"
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-sm"
              style={{ backgroundColor: p.bg }}
            >
              {p.emoji}
            </div>
            <span className="text-gray-700 font-medium text-sm">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
