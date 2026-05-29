import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Plus, CreditCard, X, Pencil, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { Modal } from '../ui/Modal'
import { formatCurrency, formatUAH, toUAH } from '../../lib/utils'
import type { Subscription, Currency, ProfileId } from '../../types'

interface Props {
  profileId: ProfileId
  currencies: Currency[]
  onSaved?: () => void
  dragHandle?: ReactNode
}

const EMPTY_FORM = { name: '', price: '', currency_id: '2', billing_cycle: 'monthly', next_billing_date: '' }
type FormState = typeof EMPTY_FORM

function advanceBillingDate(date: string, cycle: string): string {
  const d = new Date(date)
  if (cycle === 'monthly') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

function SubFormFields({ f, setF, currencies }: {
  f: FormState
  setF: (fn: (prev: FormState) => FormState) => void
  currencies: Currency[]
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">Name</label>
        <input type="text" placeholder="e.g. Spotify, ChatGPT" value={f.name}
          onChange={e => setF(p => ({ ...p, name: e.target.value }))}
          className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">Price</label>
          <input type="number" placeholder="0" value={f.price}
            onChange={e => setF(p => ({ ...p, price: e.target.value }))}
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
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">Billing Cycle</label>
        <div className="flex gap-2">
          {['monthly', 'annual'].map(cycle => (
            <button key={cycle} onClick={() => setF(p => ({ ...p, billing_cycle: cycle }))}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${f.billing_cycle === cycle ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-400 border-border hover:border-gray-500'}`}>
              {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">Next billing date (optional)</label>
        <input type="date" value={f.next_billing_date}
          onChange={e => setF(p => ({ ...p, next_billing_date: e.target.value }))}
          className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
      </div>
    </>
  )
}

function SubRow({ s, code, monthlyUAHValue, onMarkPaid, onEdit, onDelete }: {
  s: Subscription
  code: string
  monthlyUAHValue: number
  onMarkPaid: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = !!s.next_billing_date && s.next_billing_date <= today
  return (
    <div className="flex items-center justify-between py-1.5 group">
      <div>
        <div className="text-sm text-gray-300">
          {s.name}
          <span className="ml-1.5 text-xs text-gray-600">{s.billing_cycle === 'annual' ? '/yr' : '/mo'}</span>
        </div>
        {s.next_billing_date && (
          <div className={`text-xs mt-0.5 ${isOverdue ? 'text-red-400' : 'text-gray-500'}`}>
            due {new Date(s.next_billing_date).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"><X size={13} /></button>
        <button onClick={onEdit} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-white transition-all"><Pencil size={12} /></button>
        <div className="text-right">
          <div className="text-sm text-white">{formatCurrency(s.price, code)}</div>
          {code !== 'UAH' && <div className="text-xs text-gray-500">{formatUAH(monthlyUAHValue)}/mo</div>}
        </div>
        <button onClick={onMarkPaid}
          className="p-1 rounded-lg text-gray-600 hover:text-emerald-400 transition-colors" title="Mark as paid">
          <Check size={13} />
        </button>
      </div>
    </div>
  )
}

export function SubscriptionsWidget({ profileId, currencies, onSaved, dragHandle }: Props) {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editItem, setEditItem] = useState<Subscription | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)

  const load = useCallback(async () => {
    const { data } = await supabase.from('subscriptions').select('*')
      .eq('profile_id', profileId).eq('active', true)
    if (data) {
      const sorted = [...(data as Subscription[])].sort((a, b) => {
        if (!a.next_billing_date) return 1
        if (!b.next_billing_date) return -1
        return a.next_billing_date.localeCompare(b.next_billing_date)
      })
      setSubs(sorted)
    }
  }, [profileId])

  useEffect(() => { load() }, [load])

  const getRate = (id: number) => currencies.find(c => c.id === id)?.exchange_rate ?? 1
  const getCode = (id: number) => currencies.find(c => c.id === id)?.code ?? 'USD'
  const monthlyUAH = (s: Subscription) => {
    const uah = toUAH(s.price, getRate(s.currency_id))
    return s.billing_cycle === 'annual' ? uah / 12 : uah
  }

  const handleMarkPaid = async (s: Subscription) => {
    if (!s.next_billing_date) return
    await supabase.from('subscriptions').update({
      next_billing_date: advanceBillingDate(s.next_billing_date, s.billing_cycle),
    }).eq('id', s.id)
    load(); onSaved?.()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('subscriptions').update({ active: false }).eq('id', id)
    load(); onSaved?.()
  }

  const handleAdd = async () => {
    if (!form.name || !form.price) return
    await supabase.from('subscriptions').insert({
      profile_id: profileId, name: form.name, price: parseFloat(form.price),
      currency_id: parseInt(form.currency_id), billing_cycle: form.billing_cycle,
      next_billing_date: form.next_billing_date || null,
    })
    setForm(EMPTY_FORM); setShowModal(false); load(); onSaved?.()
  }

  const startEdit = (s: Subscription) => {
    setEditItem(s)
    setEditForm({ name: s.name, price: String(s.price), currency_id: String(s.currency_id), billing_cycle: s.billing_cycle, next_billing_date: s.next_billing_date ?? '' })
  }

  const handleEditSave = async () => {
    if (!editItem || !editForm.name || !editForm.price) return
    await supabase.from('subscriptions').update({
      name: editForm.name, price: parseFloat(editForm.price),
      currency_id: parseInt(editForm.currency_id), billing_cycle: editForm.billing_cycle,
      next_billing_date: editForm.next_billing_date || null,
    }).eq('id', editItem.id)
    setEditItem(null); load(); onSaved?.()
  }

  const totalMonthlyUAH = subs.reduce((sum, s) => sum + monthlyUAH(s), 0)

  return (
    <>
      <Widget title="Subscriptions" icon={<CreditCard size={14} />} dragHandle={dragHandle}
        action={<button onClick={() => setShowModal(true)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"><Plus size={14} /></button>}>
        <div className="flex flex-col gap-1">
          {subs.map(s => (
            <SubRow key={s.id} s={s}
              code={getCode(s.currency_id)}
              monthlyUAHValue={monthlyUAH(s)}
              onMarkPaid={() => handleMarkPaid(s)}
              onEdit={() => startEdit(s)}
              onDelete={() => handleDelete(s.id)}
            />
          ))}
          {subs.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No subscriptions</p>}
        </div>
        {subs.length > 0 && (
          <div className="flex justify-between items-center pt-1 border-t border-border">
            <span className="text-sm text-gray-400">Monthly total</span>
            <span className="text-white font-semibold">{formatUAH(totalMonthlyUAH)}</span>
          </div>
        )}
      </Widget>

      {showModal && (
        <Modal title="Add Subscription" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-4">
            <SubFormFields f={form} setF={setForm} currencies={currencies} />
            <button onClick={handleAdd} disabled={!form.name || !form.price}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              Add Subscription
            </button>
          </div>
        </Modal>
      )}

      {editItem && (
        <Modal title="Edit Subscription" onClose={() => setEditItem(null)}>
          <div className="flex flex-col gap-4">
            <SubFormFields f={editForm} setF={setEditForm} currencies={currencies} />
            <button onClick={handleEditSave} disabled={!editForm.name || !editForm.price}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              Save Changes
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
