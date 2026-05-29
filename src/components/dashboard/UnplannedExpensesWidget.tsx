import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Plus, Zap, Pencil } from 'lucide-react'
import { DeleteButton } from '../ui/DeleteButton'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { Modal } from '../ui/Modal'
import { formatCurrency, formatUAH, toUAH, currentMonth } from '../../lib/utils'
import type { UnplannedExpense, Currency, ProfileId } from '../../types'

interface Props {
  profileId: ProfileId
  currencies: Currency[]
  refreshKey?: number
  onSaved?: () => void
  dragHandle?: ReactNode
}

const CATEGORIES = ['Food', 'Transport', 'Health', 'Shopping', 'Entertainment', 'Other']
const EMPTY_FORM = { description: '', amount: '', currency_id: '1', category: 'Other', date: '' }
type FormState = typeof EMPTY_FORM

function UnplannedFormFields({ f, setF, currencies }: {
  f: FormState
  setF: (fn: (prev: FormState) => FormState) => void
  currencies: Currency[]
}) {
  return (
    <>
      <input type="text" placeholder="What was it?" value={f.description}
        onChange={e => setF(p => ({ ...p, description: e.target.value }))}
        className="bg-white/5 border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 w-full" />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" placeholder="Amount" value={f.amount}
          onChange={e => setF(p => ({ ...p, amount: e.target.value }))}
          className="bg-white/5 border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
        <select value={f.currency_id} onChange={e => setF(p => ({ ...p, currency_id: e.target.value }))}
          className="bg-white/5 border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
          {currencies.map(c => <option key={c.id} value={c.id} className="bg-card">{c.code}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select value={f.category} onChange={e => setF(p => ({ ...p, category: e.target.value }))}
          className="bg-white/5 border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
          {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-card">{cat}</option>)}
        </select>
        <input type="date" value={f.date} onChange={e => setF(p => ({ ...p, date: e.target.value }))}
          className="bg-white/5 border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
      </div>
    </>
  )
}

export function UnplannedExpensesWidget({ profileId, currencies, refreshKey, onSaved, dragHandle }: Props) {
  const month = currentMonth()
  const [expenses, setExpenses] = useState<UnplannedExpense[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editItem, setEditItem] = useState<UnplannedExpense | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)

  const load = useCallback(async () => {
    const startDate = month
    const endDate = new Date(new Date(month).setMonth(new Date(month).getMonth() + 1)).toISOString().slice(0, 10)
    const { data } = await supabase.from('unplanned_expenses').select('*')
      .eq('profile_id', profileId).gte('date', startDate).lt('date', endDate)
      .order('date', { ascending: false })
    if (data) setExpenses(data as UnplannedExpense[])
  }, [profileId, month])

  useEffect(() => { load() }, [load, refreshKey])

  const getRate = (id: number) => currencies.find(c => c.id === id)?.exchange_rate ?? 1
  const getCode = (id: number) => currencies.find(c => c.id === id)?.code ?? 'UAH'

  const handleAdd = async () => {
    if (!form.description || !form.amount) return
    await supabase.from('unplanned_expenses').insert({
      profile_id: profileId, description: form.description, amount: parseFloat(form.amount),
      currency_id: parseInt(form.currency_id), category: form.category,
      date: form.date || new Date().toISOString().slice(0, 10),
    })
    setForm(EMPTY_FORM); setShowForm(false); load(); onSaved?.()
  }

  const startEdit = (e: UnplannedExpense) => {
    setEditItem(e)
    setEditForm({ description: e.description, amount: String(e.amount), currency_id: String(e.currency_id), category: e.category ?? 'Other', date: e.date })
  }

  const handleEditSave = async () => {
    if (!editItem || !editForm.description || !editForm.amount) return
    await supabase.from('unplanned_expenses').update({
      description: editForm.description, amount: parseFloat(editForm.amount),
      currency_id: parseInt(editForm.currency_id), category: editForm.category, date: editForm.date,
    }).eq('id', editItem.id)
    setEditItem(null); load(); onSaved?.()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('unplanned_expenses').delete().eq('id', id); load(); onSaved?.()
  }

  const totalUAH = expenses.reduce((sum, e) => sum + toUAH(e.amount, getRate(e.currency_id)), 0)

  return (
    <>
      <Widget title="Unplanned Expenses" icon={<Zap size={14} />} dragHandle={dragHandle}
        action={<button onClick={() => setShowForm(v => !v)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"><Plus size={14} /></button>}>
        {showForm && (
          <div className="flex flex-col gap-3 p-3 bg-white/5 rounded-xl border border-border">
            <UnplannedFormFields f={form} setF={setForm} currencies={currencies} />
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl text-sm text-gray-400 hover:text-white border border-border transition-colors">Cancel</button>
              <button onClick={handleAdd} disabled={!form.description || !form.amount}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-white text-black hover:bg-gray-100 transition-colors disabled:opacity-30">Add</button>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto scrollbar-none">
          {expenses.map(e => {
            const code = getCode(e.currency_id)
            const rate = getRate(e.currency_id)
            return (
              <div key={e.id} className="flex items-center justify-between py-1.5 group">
                <div>
                  <div className="text-sm text-gray-300">{e.description}</div>
                  <div className="text-xs text-gray-400">{e.date} · {e.category}</div>
                </div>
                <div className="flex items-center gap-2">
                  <DeleteButton onDelete={() => handleDelete(e.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all" />
                  <button onClick={() => startEdit(e)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-all"><Pencil size={12} /></button>
                  <div className="text-right">
                    <div className="text-sm text-white">{formatCurrency(e.amount, code)}</div>
                    {code !== 'UAH' && <div className="text-xs text-gray-400">{formatUAH(toUAH(e.amount, rate))}</div>}
                  </div>
                </div>
              </div>
            )
          })}
          {expenses.length === 0 && !showForm && <p className="text-gray-500 text-sm text-center py-4">No unplanned expenses</p>}
        </div>
        {expenses.length > 0 && (
          <div className="flex justify-between items-center pt-1 border-t border-border">
            <span className="text-sm text-gray-400">This month</span>
            <span className="text-white font-semibold">{formatUAH(totalUAH)}</span>
          </div>
        )}
      </Widget>

      {editItem && (
        <Modal title="Edit Expense" onClose={() => setEditItem(null)}>
          <div className="flex flex-col gap-3">
            <UnplannedFormFields f={editForm} setF={setEditForm} currencies={currencies} />
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
