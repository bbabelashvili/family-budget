import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Plus, LayoutList, Pencil } from 'lucide-react'
import { DeleteButton } from '../ui/DeleteButton'
import { PaidButton } from '../ui/PaidButton'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { Modal } from '../ui/Modal'
import { formatCurrency, formatUAH, toUAH } from '../../lib/utils'
import type { RegularExpense, Currency, ProfileId } from '../../types'

type Category = RegularExpense['category']

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'family', label: 'Family' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'car', label: 'Car' },
  { value: 'debt', label: 'Debt' },
  { value: 'other', label: 'Other' },
]

interface Props {
  profileId: ProfileId
  currencies: Currency[]
  onSaved?: () => void
  dragHandle?: ReactNode
}

const EMPTY_FORM = { name: '', amount: '', currency_id: '1', category: 'other' as Category, frequency: 'monthly' }
type FormState = typeof EMPTY_FORM

function ExpenseFormFields({ f, setF, currencies }: {
  f: FormState
  setF: (fn: (prev: FormState) => FormState) => void
  currencies: Currency[]
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">Name</label>
        <input type="text" placeholder="e.g. Rent, Internet, Insurance" value={f.name}
          onChange={e => setF(p => ({ ...p, name: e.target.value }))}
          className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">Amount</label>
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
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">Category</label>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map(cat => (
            <button key={cat.value} onClick={() => setF(p => ({ ...p, category: cat.value }))}
              className={`py-2 rounded-xl text-xs font-medium border transition-colors ${f.category === cat.value ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-400 border-border hover:border-gray-500'}`}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">Frequency</label>
        <div className="flex gap-2">
          {['monthly', 'annual'].map(freq => (
            <button key={freq} onClick={() => setF(p => ({ ...p, frequency: freq }))}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${f.frequency === freq ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-400 border-border hover:border-gray-500'}`}>
              {freq.charAt(0).toUpperCase() + freq.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function paidKey(profileId: string) {
  const d = new Date()
  return `regular_paid_${profileId}_${d.getFullYear()}_${d.getMonth()}`
}

export function RegularExpensesWidget({ profileId, currencies, onSaved, dragHandle }: Props) {
  const [expenses, setExpenses] = useState<RegularExpense[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editItem, setEditItem] = useState<RegularExpense | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)
  const [paidIds, setPaidIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(paidKey(profileId)) ?? '[]') as string[]) }
    catch { return new Set() }
  })

  const load = useCallback(async () => {
    const { data } = await supabase.from('regular_expenses').select('*')
      .eq('profile_id', profileId).eq('active', true).order('category').order('name')
    if (data) setExpenses(data as RegularExpense[])
  }, [profileId])

  useEffect(() => { load() }, [load])

  const getRate = (id: number) => currencies.find(c => c.id === id)?.exchange_rate ?? 1
  const getCode = (id: number) => currencies.find(c => c.id === id)?.code ?? 'UAH'
  const monthlyUAH = (e: RegularExpense) => {
    const uah = toUAH(e.amount, getRate(e.currency_id))
    return e.frequency === 'annual' ? uah / 12 : uah
  }
  const totalMonthlyUAH = expenses.reduce((sum, e) => sum + monthlyUAH(e), 0)

  const handleDelete = async (id: string) => {
    await supabase.from('regular_expenses').update({ active: false }).eq('id', id); load(); onSaved?.()
  }

  const togglePaid = (id: string) => {
    setPaidIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem(paidKey(profileId), JSON.stringify([...next]))
      return next
    })
  }

  const handleAdd = async () => {
    if (!form.name || !form.amount) return
    await supabase.from('regular_expenses').insert({
      profile_id: profileId, name: form.name, amount: parseFloat(form.amount),
      currency_id: parseInt(form.currency_id), category: form.category, frequency: form.frequency,
    })
    setForm(EMPTY_FORM); setShowModal(false); load(); onSaved?.()
  }

  const startEdit = (e: RegularExpense) => {
    setEditItem(e)
    setEditForm({ name: e.name, amount: String(e.amount), currency_id: String(e.currency_id), category: e.category, frequency: e.frequency })
  }

  const handleEditSave = async () => {
    if (!editItem || !editForm.name || !editForm.amount) return
    await supabase.from('regular_expenses').update({
      name: editForm.name, amount: parseFloat(editForm.amount),
      currency_id: parseInt(editForm.currency_id), category: editForm.category, frequency: editForm.frequency,
    }).eq('id', editItem.id)
    setEditItem(null); load(); onSaved?.()
  }

  const byCategory = CATEGORIES.map(cat => ({
    ...cat, items: expenses.filter(e => e.category === cat.value),
  })).filter(g => g.items.length > 0)

  return (
    <>
      <Widget title="Regular Expenses" icon={<LayoutList size={14} />} dragHandle={dragHandle}
        action={<button onClick={() => setShowModal(true)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"><Plus size={14} /></button>}>
        {byCategory.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No regular expenses</p>
        ) : (
          <div className="flex flex-col gap-4">
            {byCategory.map(group => (
              <div key={group.value}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{group.label}</p>
                <div className="flex flex-col gap-1">
                  {group.items.map(e => {
                    const code = getCode(e.currency_id)
                    const isPaid = paidIds.has(e.id)
                    return (
                      <div key={e.id} className={`flex items-center justify-between py-1.5 group transition-opacity ${isPaid ? 'opacity-40' : ''}`}>
                        <div>
                          <span className={`text-sm ${isPaid ? 'line-through text-gray-500' : 'text-gray-300'}`}>{e.name}</span>
                          {e.frequency === 'annual' && <span className="ml-2 text-xs text-gray-600">/yr</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <DeleteButton onDelete={() => handleDelete(e.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all" />
                          <button onClick={() => startEdit(e)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-all"><Pencil size={12} /></button>
                          <div className="text-right">
                            <div className="text-sm text-white">{formatCurrency(e.amount, code)}</div>
                            {code !== 'UAH' && <div className="text-xs text-gray-400">{formatUAH(monthlyUAH(e))}/mo</div>}
                          </div>
                          <PaidButton isPaid={isPaid} onToggle={() => togglePaid(e.id)} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        {expenses.length > 0 && (
          <div className="flex justify-between items-center pt-1 border-t border-border mt-2">
            <span className="text-sm text-gray-400">Monthly total</span>
            <span className="text-white font-semibold">{formatUAH(totalMonthlyUAH)}</span>
          </div>
        )}
      </Widget>

      {showModal && (
        <Modal title="Add Regular Expense" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-4">
            <ExpenseFormFields f={form} setF={setForm} currencies={currencies} />
            <button onClick={handleAdd} disabled={!form.name || !form.amount}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-1">
              Add Expense
            </button>
          </div>
        </Modal>
      )}

      {editItem && (
        <Modal title="Edit Expense" onClose={() => setEditItem(null)}>
          <div className="flex flex-col gap-4">
            <ExpenseFormFields f={editForm} setF={setEditForm} currencies={currencies} />
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
