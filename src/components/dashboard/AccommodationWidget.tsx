import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Plus, BedDouble, Pencil, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { Modal } from '../ui/Modal'
import { formatCurrency, formatUAH, toUAH } from '../../lib/utils'
import type { TravelAccommodation, Currency, ProfileId } from '../../types'

interface Props {
  profileId: ProfileId
  currencies: Currency[]
  displayCurrencyId?: number
  onSaved?: () => void
  dragHandle?: ReactNode
}

const EMPTY_FORM = { name: '', check_in: '', check_out: '', amount: '', currency_id: '2', notes: '' }
type FormState = typeof EMPTY_FORM

function nightCount(checkIn: string, checkOut: string): number | null {
  if (!checkIn || !checkOut) return null
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  return Math.round(diff / 86400000)
}

function AccomFormFields({ f, setF, currencies }: {
  f: FormState
  setF: (fn: (prev: FormState) => FormState) => void
  currencies: Currency[]
}) {
  const nights = nightCount(f.check_in, f.check_out)
  const perNight = nights && parseFloat(f.amount) ? parseFloat(f.amount) / nights : null
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">Property name</label>
        <input type="text" placeholder="e.g. Hotel Riviera, Airbnb Paris" value={f.name}
          onChange={e => setF(p => ({ ...p, name: e.target.value }))}
          className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">Check-in</label>
          <input type="date" value={f.check_in} onChange={e => setF(p => ({ ...p, check_in: e.target.value }))}
            className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">Check-out</label>
          <input type="date" value={f.check_out} onChange={e => setF(p => ({ ...p, check_out: e.target.value }))}
            className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">Total amount</label>
          <input type="number" placeholder="0" value={f.amount}
            onChange={e => setF(p => ({ ...p, amount: e.target.value }))}
            className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">Currency</label>
          <select value={f.currency_id} onChange={e => setF(p => ({ ...p, currency_id: e.target.value }))}
            className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
            {currencies.map(c => <option key={c.id} value={c.id} className="bg-card">{c.code}</option>)}
          </select>
        </div>
      </div>
      {nights !== null && nights > 0 && perNight !== null && (
        <div className="bg-white/5 rounded-xl px-3 py-2 text-sm text-gray-400">
          {nights} night{nights !== 1 ? 's' : ''} · {formatCurrency(perNight, currencies.find(c => c.id === parseInt(f.currency_id))?.code ?? 'USD')}/night
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">Notes (optional)</label>
        <input type="text" placeholder="Confirmation #, address…" value={f.notes}
          onChange={e => setF(p => ({ ...p, notes: e.target.value }))}
          className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
      </div>
    </>
  )
}

export function AccommodationWidget({ profileId, currencies, displayCurrencyId, onSaved, dragHandle }: Props) {
  const [items, setItems] = useState<TravelAccommodation[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editItem, setEditItem] = useState<TravelAccommodation | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)

  const load = useCallback(async () => {
    const { data } = await supabase.from('travel_accommodations').select('*')
      .eq('profile_id', profileId).order('check_in')
    if (data) setItems(data as TravelAccommodation[])
  }, [profileId])

  useEffect(() => { load() }, [load])

  const getRate = (id: number) => currencies.find(c => c.id === id)?.exchange_rate ?? 1
  const getCode = (id: number) => currencies.find(c => c.id === id)?.code ?? 'USD'
  const totalUAH = items.reduce((s, i) => s + toUAH(i.amount, getRate(i.currency_id)), 0)
  const displayRate = displayCurrencyId ? (currencies.find(c => c.id === displayCurrencyId)?.exchange_rate ?? 1) : 1
  const displayCode = displayCurrencyId ? (currencies.find(c => c.id === displayCurrencyId)?.code ?? 'UAH') : 'UAH'
  const formattedTotal = displayCurrencyId ? formatCurrency(totalUAH / displayRate, displayCode) : formatUAH(totalUAH)

  const handleAdd = async () => {
    if (!form.name || !form.amount) return
    await supabase.from('travel_accommodations').insert({
      profile_id: profileId, name: form.name,
      check_in: form.check_in || null, check_out: form.check_out || null,
      amount: parseFloat(form.amount), currency_id: parseInt(form.currency_id),
      notes: form.notes || null,
    })
    setForm(EMPTY_FORM); setShowModal(false); load(); onSaved?.()
  }

  const startEdit = (item: TravelAccommodation) => {
    setEditItem(item)
    setEditForm({ name: item.name, check_in: item.check_in ?? '', check_out: item.check_out ?? '', amount: String(item.amount), currency_id: String(item.currency_id), notes: item.notes ?? '' })
  }

  const handleEditSave = async () => {
    if (!editItem || !editForm.name || !editForm.amount) return
    await supabase.from('travel_accommodations').update({
      name: editForm.name, check_in: editForm.check_in || null, check_out: editForm.check_out || null,
      amount: parseFloat(editForm.amount), currency_id: parseInt(editForm.currency_id), notes: editForm.notes || null,
    }).eq('id', editItem.id)
    setEditItem(null); load(); onSaved?.()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('travel_accommodations').delete().eq('id', id); load(); onSaved?.()
  }

  return (
    <>
      <Widget title="Accommodation" icon={<BedDouble size={14} />} dragHandle={dragHandle}
        action={<button onClick={() => setShowModal(true)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"><Plus size={14} /></button>}>
        <div className="flex flex-col gap-3">
          {items.map(item => {
            const code = getCode(item.currency_id)
            const nights = nightCount(item.check_in ?? '', item.check_out ?? '')
            return (
              <div key={item.id} className="group">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-white font-medium">{item.name}</div>
                    {(item.check_in || item.check_out) && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {item.check_in && new Date(item.check_in).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                        {item.check_in && item.check_out && ' → '}
                        {item.check_out && new Date(item.check_out).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                        {nights !== null && nights > 0 && ` · ${nights}n`}
                      </div>
                    )}
                    {item.notes && <div className="text-xs text-gray-600 mt-0.5">{item.notes}</div>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="text-right mr-1">
                      <div className="text-sm text-white font-medium">{formatCurrency(item.amount, code)}</div>
                      {code !== 'UAH' && <div className="text-xs text-gray-500">{formatUAH(toUAH(item.amount, getRate(item.currency_id)))}</div>}
                    </div>
                    <button onClick={() => startEdit(item)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-white transition-all"><Pencil size={12} /></button>
                    <button onClick={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"><X size={13} /></button>
                  </div>
                </div>
              </div>
            )
          })}
          {items.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No accommodation added</p>}
        </div>
        {items.length > 0 && (
          <div className="flex justify-between items-center pt-1 border-t border-border">
            <span className="text-sm text-gray-400">Total</span>
            <span className="text-white font-semibold">{formattedTotal}</span>
          </div>
        )}
      </Widget>

      {showModal && (
        <Modal title="Add Accommodation" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-4">
            <AccomFormFields f={form} setF={setForm} currencies={currencies} />
            <button onClick={handleAdd} disabled={!form.name || !form.amount}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-1">
              Add Accommodation
            </button>
          </div>
        </Modal>
      )}

      {editItem && (
        <Modal title="Edit Accommodation" onClose={() => setEditItem(null)}>
          <div className="flex flex-col gap-4">
            <AccomFormFields f={editForm} setF={setEditForm} currencies={currencies} />
            <button onClick={handleEditSave} disabled={!editForm.name || !editForm.amount}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-1">
              Save Changes
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
