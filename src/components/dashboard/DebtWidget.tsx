import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Plus, Landmark, Check, Pencil } from 'lucide-react'
import { DeleteButton } from '../ui/DeleteButton'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { Modal } from '../ui/Modal'
import { formatCurrency, formatUAH, toUAH } from '../../lib/utils'
import type { Debt, Currency, ProfileId } from '../../types'

interface Props {
  profileId: ProfileId
  currencies: Currency[]
  onSaved?: () => void
  dragHandle?: ReactNode
}

const CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'weekly', label: 'Weekly' },
]

const EMPTY_FORM = { name: '', payment_amount: '', payments_total: '', payments_left: '', currency_id: '2', billing_cycle: 'monthly', due_date: '' }
type FormState = typeof EMPTY_FORM

function advanceDueDate(date: string, cycle: string): string {
  const d = new Date(date)
  if (cycle === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (cycle === 'biweekly') d.setDate(d.getDate() + 14)
  else d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

function DebtFormFields({ f, setF, currencies, isEdit = false }: {
  f: FormState
  setF: (fn: (prev: FormState) => FormState) => void
  currencies: Currency[]
  isEdit?: boolean
}) {
  const getCode = (id: number) => currencies.find(c => c.id === id)?.code ?? 'USD'
  const gross = parseFloat(f.payment_amount) || 0
  const total = parseInt(f.payments_total) || 0
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">Debt name</label>
        <input type="text" placeholder="e.g. Car loan, Mortgage" value={f.name}
          onChange={e => setF(p => ({ ...p, name: e.target.value }))}
          className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">Payment amount</label>
          <input type="number" placeholder="0" value={f.payment_amount}
            onChange={e => setF(p => ({ ...p, payment_amount: e.target.value }))}
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
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">Total payments</label>
          <input type="number" placeholder="e.g. 24" value={f.payments_total}
            onChange={e => setF(p => ({ ...p, payments_total: e.target.value }))}
            className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">{isEdit ? 'Payments left' : 'Already paid (optional)'}</label>
          <input type="number" placeholder="0" value={f.payments_left}
            onChange={e => setF(p => ({ ...p, payments_left: e.target.value }))}
            className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">Next due date</label>
          <input type="date" value={f.due_date} onChange={e => setF(p => ({ ...p, due_date: e.target.value }))}
            className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">Billing cycle</label>
          <select value={f.billing_cycle} onChange={e => setF(p => ({ ...p, billing_cycle: e.target.value }))}
            className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
            {CYCLES.map(c => <option key={c.value} value={c.value} className="bg-card">{c.label}</option>)}
          </select>
        </div>
      </div>
      {!isEdit && gross > 0 && total > 0 && (
        <div className="bg-white/5 rounded-xl px-3 py-2 text-sm text-gray-400">
          Total debt: <span className="text-white font-medium">{formatCurrency(gross * total, getCode(parseInt(f.currency_id)))}</span>
        </div>
      )}
    </>
  )
}

export function DebtWidget({ profileId, currencies, onSaved, dragHandle }: Props) {
  const [debts, setDebts] = useState<Debt[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editItem, setEditItem] = useState<Debt | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)

  const load = useCallback(async () => {
    const { data } = await supabase.from('debts').select('*')
      .eq('profile_id', profileId).eq('active', true).order('due_date')
    if (data) setDebts(data as Debt[])
  }, [profileId])

  useEffect(() => { load() }, [load])

  const getRate = (id: number) => currencies.find(c => c.id === id)?.exchange_rate ?? 1
  const getCode = (id: number) => currencies.find(c => c.id === id)?.code ?? 'USD'

  const handleMarkPaid = async (debt: Debt) => {
    if (debt.payments_left <= 0) return
    const newLeft = debt.payments_left - 1
    await supabase.from('debts').update({
      payments_left: newLeft,
      due_date: advanceDueDate(debt.due_date, debt.billing_cycle),
      active: newLeft > 0,
    }).eq('id', debt.id)
    load(); onSaved?.()
  }

  const handleAdd = async () => {
    if (!form.name || !form.payment_amount || !form.payments_total || !form.due_date) return
    const total = parseInt(form.payments_total)
    const paidCount = form.payments_left ? parseInt(form.payments_left) : 0
    const left = total - paidCount
    const payAmt = parseFloat(form.payment_amount)
    await supabase.from('debts').insert({
      profile_id: profileId, name: form.name, total_amount: payAmt * total,
      payment_amount: payAmt, payments_total: total, payments_left: left,
      currency_id: parseInt(form.currency_id), billing_cycle: form.billing_cycle, due_date: form.due_date,
    })
    setForm(EMPTY_FORM); setShowModal(false); load(); onSaved?.()
  }

  const startEdit = (d: Debt) => {
    setEditItem(d)
    setEditForm({ name: d.name, payment_amount: String(d.payment_amount), payments_total: String(d.payments_total), payments_left: String(d.payments_left), currency_id: String(d.currency_id), billing_cycle: d.billing_cycle, due_date: d.due_date })
  }

  const handleEditSave = async () => {
    if (!editItem || !editForm.name || !editForm.payment_amount || !editForm.due_date) return
    const payAmt = parseFloat(editForm.payment_amount)
    const total = parseInt(editForm.payments_total) || editItem.payments_total
    const left = parseInt(editForm.payments_left) ?? editItem.payments_left
    await supabase.from('debts').update({
      name: editForm.name, total_amount: payAmt * total, payment_amount: payAmt,
      payments_total: total, payments_left: left, currency_id: parseInt(editForm.currency_id),
      billing_cycle: editForm.billing_cycle, due_date: editForm.due_date,
    }).eq('id', editItem.id)
    setEditItem(null); load(); onSaved?.()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('debts').update({ active: false }).eq('id', id); load(); onSaved?.()
  }

  return (
    <>
      <Widget title="Debts" icon={<Landmark size={14} />} dragHandle={dragHandle}
        action={<button onClick={() => setShowModal(true)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"><Plus size={14} /></button>}>
        <div className="flex flex-col gap-4">
          {debts.map(d => {
            const code = getCode(d.currency_id)
            const rate = getRate(d.currency_id)
            const paid = d.payments_total - d.payments_left
            const pct = Math.round((paid / d.payments_total) * 100)
            const remaining = d.payment_amount * d.payments_left
            const dueDate = new Date(d.due_date)
            const isOverdue = dueDate < new Date()
            return (
              <div key={d.id} className="group">
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <span className="text-sm text-white font-medium">{d.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-gray-500'}`}>
                        due {dueDate.toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="text-xs text-gray-600">{paid}/{d.payments_total} paid</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DeleteButton onDelete={() => handleDelete(d.id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all" />
                    <button onClick={() => startEdit(d)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-white transition-all"><Pencil size={12} /></button>
                    <div className="text-right">
                      <div className="text-sm text-white font-medium">{formatCurrency(remaining, code)}</div>
                      {code !== 'UAH' && <div className="text-xs text-gray-500">{formatUAH(toUAH(remaining, rate))}</div>}
                    </div>
                    <button onClick={() => handleMarkPaid(d)}
                      className="p-1 rounded-lg text-gray-600 hover:text-emerald-400 transition-colors" title="Mark payment as made">
                      <Check size={13} />
                    </button>
                  </div>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-gray-600 mt-1">{pct}% paid · {d.payments_left} left</div>
              </div>
            )
          })}
          {debts.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No active debts</p>}
        </div>
      </Widget>

      {showModal && (
        <Modal title="Add Debt" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-4">
            <DebtFormFields f={form} setF={setForm} currencies={currencies} />
            <button onClick={handleAdd} disabled={!form.name || !form.payment_amount || !form.payments_total || !form.due_date}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-1">
              Add Debt
            </button>
          </div>
        </Modal>
      )}

      {editItem && (
        <Modal title="Edit Debt" onClose={() => setEditItem(null)}>
          <div className="flex flex-col gap-4">
            <DebtFormFields f={editForm} setF={setEditForm} currencies={currencies} isEdit />
            <button onClick={handleEditSave} disabled={!editForm.name || !editForm.payment_amount || !editForm.due_date}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-1">
              Save Changes
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
