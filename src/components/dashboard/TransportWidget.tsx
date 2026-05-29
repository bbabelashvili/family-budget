import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Plus, Plane, Pencil } from 'lucide-react'
import { DeleteButton } from '../ui/DeleteButton'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { Modal } from '../ui/Modal'
import { formatCurrency, formatUAH, toUAH } from '../../lib/utils'
import type { TravelTransport, TransportType, Currency, ProfileId } from '../../types'

interface Props {
  profileId: ProfileId
  currencies: Currency[]
  displayCurrencyId?: number
  onSaved?: () => void
  dragHandle?: ReactNode
}

const TRANSPORT_TYPES: { value: TransportType; label: string; emoji: string }[] = [
  { value: 'flight', label: 'Flight', emoji: '✈️' },
  { value: 'train', label: 'Train', emoji: '🚂' },
  { value: 'car', label: 'Car', emoji: '🚗' },
  { value: 'bus', label: 'Bus', emoji: '🚌' },
  { value: 'ferry', label: 'Ferry', emoji: '⛴️' },
  { value: 'other', label: 'Other', emoji: '🎫' },
]

const EMPTY_FORM = { type: 'flight' as TransportType, description: '', from_location: '', to_location: '', date: '', amount: '', currency_id: '2', notes: '' }
type FormState = typeof EMPTY_FORM

function TransportFormFields({ f, setF, currencies }: {
  f: FormState
  setF: (fn: (prev: FormState) => FormState) => void
  currencies: Currency[]
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">Type</label>
        <div className="grid grid-cols-3 gap-2">
          {TRANSPORT_TYPES.map(t => (
            <button key={t.value} onClick={() => setF(p => ({ ...p, type: t.value }))}
              className={`py-2 rounded-xl text-xs font-medium border transition-colors ${f.type === t.value ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-400 border-border hover:border-gray-500'}`}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">Description</label>
        <input type="text" placeholder="e.g. KBP → CDG, Kyiv—Lviv bus" value={f.description}
          onChange={e => setF(p => ({ ...p, description: e.target.value }))}
          className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">From</label>
          <input type="text" placeholder="City / airport" value={f.from_location}
            onChange={e => setF(p => ({ ...p, from_location: e.target.value }))}
            className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">To</label>
          <input type="text" placeholder="City / airport" value={f.to_location}
            onChange={e => setF(p => ({ ...p, to_location: e.target.value }))}
            className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">Date</label>
          <input type="date" value={f.date} onChange={e => setF(p => ({ ...p, date: e.target.value }))}
            className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">Amount</label>
          <input type="number" placeholder="0" value={f.amount}
            onChange={e => setF(p => ({ ...p, amount: e.target.value }))}
            className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">Currency</label>
        <select value={f.currency_id} onChange={e => setF(p => ({ ...p, currency_id: e.target.value }))}
          className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
          {currencies.map(c => <option key={c.id} value={c.id} className="bg-card">{c.code}</option>)}
        </select>
      </div>
    </>
  )
}

export function TransportWidget({ profileId, currencies, displayCurrencyId, onSaved, dragHandle }: Props) {
  const [items, setItems] = useState<TravelTransport[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editItem, setEditItem] = useState<TravelTransport | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)

  const load = useCallback(async () => {
    const { data } = await supabase.from('travel_transport').select('*')
      .eq('profile_id', profileId).order('date', { nullsFirst: false })
    if (data) setItems(data as TravelTransport[])
  }, [profileId])

  useEffect(() => { load() }, [load])

  const getRate = (id: number) => currencies.find(c => c.id === id)?.exchange_rate ?? 1
  const getCode = (id: number) => currencies.find(c => c.id === id)?.code ?? 'USD'
  const totalUAH = items.reduce((s, i) => s + toUAH(i.amount, getRate(i.currency_id)), 0)
  const displayRate = displayCurrencyId ? (currencies.find(c => c.id === displayCurrencyId)?.exchange_rate ?? 1) : 1
  const displayCode = displayCurrencyId ? (currencies.find(c => c.id === displayCurrencyId)?.code ?? 'UAH') : 'UAH'
  const formattedTotal = displayCurrencyId ? formatCurrency(totalUAH / displayRate, displayCode) : formatUAH(totalUAH)
  const typeEmoji = (type: TransportType) => TRANSPORT_TYPES.find(t => t.value === type)?.emoji ?? '🎫'

  const handleAdd = async () => {
    if (!form.description || !form.amount) return
    await supabase.from('travel_transport').insert({
      profile_id: profileId, type: form.type, description: form.description,
      from_location: form.from_location || null, to_location: form.to_location || null,
      date: form.date || null, amount: parseFloat(form.amount),
      currency_id: parseInt(form.currency_id), notes: form.notes || null,
    })
    setForm(EMPTY_FORM); setShowModal(false); load(); onSaved?.()
  }

  const startEdit = (item: TravelTransport) => {
    setEditItem(item)
    setEditForm({
      type: item.type, description: item.description,
      from_location: item.from_location ?? '', to_location: item.to_location ?? '',
      date: item.date ?? '', amount: String(item.amount),
      currency_id: String(item.currency_id), notes: item.notes ?? '',
    })
  }

  const handleEditSave = async () => {
    if (!editItem || !editForm.description || !editForm.amount) return
    await supabase.from('travel_transport').update({
      type: editForm.type, description: editForm.description,
      from_location: editForm.from_location || null, to_location: editForm.to_location || null,
      date: editForm.date || null, amount: parseFloat(editForm.amount),
      currency_id: parseInt(editForm.currency_id), notes: editForm.notes || null,
    }).eq('id', editItem.id)
    setEditItem(null); load(); onSaved?.()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('travel_transport').delete().eq('id', id); load(); onSaved?.()
  }

  return (
    <>
      <Widget title="Getting There" icon={<Plane size={14} />} dragHandle={dragHandle}
        action={<button onClick={() => setShowModal(true)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"><Plus size={14} /></button>}>
        <div className="flex flex-col gap-2">
          {items.map(item => {
            const code = getCode(item.currency_id)
            return (
              <div key={item.id} className="group flex items-start justify-between py-1">
                <div className="flex gap-2.5 items-start">
                  <span className="text-base mt-0.5">{typeEmoji(item.type)}</span>
                  <div>
                    <div className="text-sm text-white">{item.description}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {item.from_location && item.to_location && (
                        <span className="text-xs text-gray-500">{item.from_location} → {item.to_location}</span>
                      )}
                      {item.date && (
                        <span className="text-xs text-gray-600">
                          {item.from_location && item.to_location && '· '}
                          {new Date(item.date).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                  <div className="text-right mr-1">
                    <div className="text-sm text-white font-medium">{formatCurrency(item.amount, code)}</div>
                    {code !== 'UAH' && <div className="text-xs text-gray-500">{formatUAH(toUAH(item.amount, getRate(item.currency_id)))}</div>}
                  </div>
                  <button onClick={() => startEdit(item)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-white transition-all"><Pencil size={12} /></button>
                  <DeleteButton onDelete={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all" />
                </div>
              </div>
            )
          })}
          {items.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No transport added</p>}
        </div>
        {items.length > 0 && (
          <div className="flex justify-between items-center pt-1 border-t border-border">
            <span className="text-sm text-gray-400">Total</span>
            <span className="text-white font-semibold">{formattedTotal}</span>
          </div>
        )}
      </Widget>

      {showModal && (
        <Modal title="Add Transport" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-4">
            <TransportFormFields f={form} setF={setForm} currencies={currencies} />
            <button onClick={handleAdd} disabled={!form.description || !form.amount}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-1">
              Add Transport
            </button>
          </div>
        </Modal>
      )}

      {editItem && (
        <Modal title="Edit Transport" onClose={() => setEditItem(null)}>
          <div className="flex flex-col gap-4">
            <TransportFormFields f={editForm} setF={setEditForm} currencies={currencies} />
            <button onClick={handleEditSave} disabled={!editForm.description || !editForm.amount}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-1">
              Save Changes
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
