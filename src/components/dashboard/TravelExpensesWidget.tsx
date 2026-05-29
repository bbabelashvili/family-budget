import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Plus, Receipt, Pencil, X, Settings, PieChart, List } from 'lucide-react'
import { DeleteButton } from '../ui/DeleteButton'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { Modal } from '../ui/Modal'
import { formatCurrency, formatUAH, toUAH } from '../../lib/utils'
import type { TravelExpense, Currency, ProfileId } from '../../types'

interface Props {
  profileId: ProfileId
  currencies: Currency[]
  displayCurrencyId?: number
  onSaved?: () => void
  dragHandle?: ReactNode
}

export const DEFAULT_TRAVEL_CATEGORIES = ['Food', 'Drinks', 'Activities', 'Shopping', 'Local transport', 'Entrance fees', 'Other']

const PALETTE = [
  '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6',
  '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#a78bfa',
]

const EMPTY_FORM = { description: '', category: 'Other', date: new Date().toISOString().slice(0, 10), amount: '', currency_id: '2' }
type FormState = typeof EMPTY_FORM

// ── module-scope form component ───────────────────────────────────────────────

function ExpenseFormFields({ f, setF, currencies, allCategories }: {
  f: FormState
  setF: (fn: (prev: FormState) => FormState) => void
  currencies: Currency[]
  allCategories: string[]
}) {
  return (
    <>
      <input type="text" placeholder="What was it?" value={f.description}
        onChange={e => setF(p => ({ ...p, description: e.target.value }))}
        className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 w-full" />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" placeholder="Amount" value={f.amount}
          onChange={e => setF(p => ({ ...p, amount: e.target.value }))}
          className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
        <select value={f.currency_id} onChange={e => setF(p => ({ ...p, currency_id: e.target.value }))}
          className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
          {currencies.map(c => <option key={c.id} value={c.id} className="bg-card">{c.code}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select value={f.category} onChange={e => setF(p => ({ ...p, category: e.target.value }))}
          className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
          {allCategories.map(cat => <option key={cat} value={cat} className="bg-card">{cat}</option>)}
        </select>
        <input type="date" value={f.date} onChange={e => setF(p => ({ ...p, date: e.target.value }))}
          className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
      </div>
    </>
  )
}

// ── main widget ───────────────────────────────────────────────────────────────

export function TravelExpensesWidget({ profileId, currencies, displayCurrencyId, onSaved, dragHandle }: Props) {
  const [expenses, setExpenses] = useState<TravelExpense[]>([])
  const [userCategories, setUserCategories] = useState<string[]>([])
  const [flipped, setFlipped] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editItem, setEditItem] = useState<TravelExpense | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)
  const [showCatModal, setShowCatModal] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  const allCategories = [...DEFAULT_TRAVEL_CATEGORIES, ...userCategories.filter(c => !DEFAULT_TRAVEL_CATEGORIES.includes(c))]

  const loadCategories = useCallback(async () => {
    const { data } = await supabase.from('travel_expense_categories').select('name')
      .eq('profile_id', profileId).order('name')
    if (data) setUserCategories(data.map((r: { name: string }) => r.name))
  }, [profileId])

  const load = useCallback(async () => {
    const { data } = await supabase.from('travel_expenses').select('*')
      .eq('profile_id', profileId).order('date', { ascending: false }).order('created_at', { ascending: false })
    if (data) setExpenses(data as TravelExpense[])
  }, [profileId])

  useEffect(() => { load(); loadCategories() }, [load, loadCategories])

  const getRate = (id: number) => currencies.find(c => c.id === id)?.exchange_rate ?? 1
  const getCode = (id: number) => currencies.find(c => c.id === id)?.code ?? 'USD'

  const handleAdd = async () => {
    if (!form.description || !form.amount) return
    await supabase.from('travel_expenses').insert({
      profile_id: profileId, description: form.description, category: form.category,
      date: form.date || new Date().toISOString().slice(0, 10),
      amount: parseFloat(form.amount), currency_id: parseInt(form.currency_id),
    })
    setForm(p => ({ ...EMPTY_FORM, currency_id: p.currency_id, date: p.date }))
    setShowForm(false); load(); onSaved?.()
  }

  const startEdit = (e: TravelExpense) => {
    setEditItem(e)
    setEditForm({ description: e.description, category: e.category, date: e.date, amount: String(e.amount), currency_id: String(e.currency_id) })
  }

  const handleEditSave = async () => {
    if (!editItem || !editForm.description || !editForm.amount) return
    await supabase.from('travel_expenses').update({
      description: editForm.description, category: editForm.category, date: editForm.date,
      amount: parseFloat(editForm.amount), currency_id: parseInt(editForm.currency_id),
    }).eq('id', editItem.id)
    setEditItem(null); load(); onSaved?.()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('travel_expenses').delete().eq('id', id); load(); onSaved?.()
  }

  const addCategory = async () => {
    const name = newCatName.trim()
    if (!name || allCategories.includes(name)) return
    await supabase.from('travel_expense_categories').insert({ profile_id: profileId, name })
    setNewCatName(''); loadCategories()
  }

  const deleteCategory = async (name: string) => {
    await supabase.from('travel_expense_categories').delete().eq('profile_id', profileId).eq('name', name)
    loadCategories()
  }

  // ── derived values ──────────────────────────────────────────────────────────

  const byDate = expenses.reduce<Record<string, TravelExpense[]>>((acc, e) => {
    acc[e.date] = acc[e.date] ? [...acc[e.date], e] : [e]
    return acc
  }, {})
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  const totalUAH = expenses.reduce((s, e) => s + toUAH(e.amount, getRate(e.currency_id)), 0)
  const displayRate = displayCurrencyId ? (currencies.find(c => c.id === displayCurrencyId)?.exchange_rate ?? 1) : 1
  const displayCode = displayCurrencyId ? (currencies.find(c => c.id === displayCurrencyId)?.code ?? 'UAH') : 'UAH'
  const fmt = (uah: number) => displayCurrencyId ? formatCurrency(uah / displayRate, displayCode) : formatUAH(uah)

  // Chart data
  const categoryMap = expenses.reduce<Record<string, number>>((acc, e) => {
    const uah = toUAH(e.amount, getRate(e.currency_id))
    acc[e.category] = (acc[e.category] ?? 0) + uah
    return acc
  }, {})
  const chartData = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([category, uah], i) => ({ category, uah, color: PALETTE[i % PALETTE.length] }))

  let cumPct = 0
  const gradient = chartData.length > 0
    ? `conic-gradient(${chartData.map(d => {
        const pct = (d.uah / totalUAH) * 100
        const part = `${d.color} ${cumPct.toFixed(2)}% ${(cumPct + pct).toFixed(2)}%`
        cumPct += pct
        return part
      }).join(', ')})`
    : 'conic-gradient(#ffffff15 0% 100%)'

  // ── render ──────────────────────────────────────────────────────────────────

  const title = flipped ? 'Other Expenses by Category' : 'Other Expenses'

  const actions = (
    <div className="flex items-center gap-1">
      {!flipped && (
        <>
          <button onClick={() => setShowCatModal(true)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-colors" title="Manage categories">
            <Settings size={13} />
          </button>
          <button onClick={() => setShowForm(v => !v)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors">
            <Plus size={14} />
          </button>
        </>
      )}
      <button
        onClick={() => { setFlipped(v => !v); setShowForm(false) }}
        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-colors"
        title={flipped ? 'Show list' : 'Show chart'}
      >
        {flipped ? <List size={13} /> : <PieChart size={13} />}
      </button>
    </div>
  )

  return (
    <>
      <Widget title={title} icon={<Receipt size={14} />} action={actions} dragHandle={dragHandle}>
        {/* 3D flip container */}
        <div style={{ perspective: '1000px' }}>
          <div
            className="relative transition-transform duration-500"
            style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
          >
            {/* ── Front: list ── */}
            <div style={{ backfaceVisibility: 'hidden' }}>
              {showForm && (
                <div className="flex flex-col gap-3 p-3 bg-white/5 rounded-xl border border-border mb-2">
                  <ExpenseFormFields f={form} setF={setForm} currencies={currencies} allCategories={allCategories} />
                  <div className="flex gap-2">
                    <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl text-sm text-gray-400 hover:text-white border border-border transition-colors">Cancel</button>
                    <button onClick={handleAdd} disabled={!form.description || !form.amount}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold bg-white text-black hover:bg-gray-100 transition-colors disabled:opacity-30">Add</button>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-4 max-h-96 overflow-y-auto scrollbar-none">
                {sortedDates.map(date => {
                  const dayItems = byDate[date]
                  const dayUAH = dayItems.reduce((s, e) => s + toUAH(e.amount, getRate(e.currency_id)), 0)
                  return (
                    <div key={date}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs text-gray-500 font-medium">
                          {new Date(date).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        <span className="text-xs text-gray-500">{fmt(dayUAH)}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {dayItems.map(e => {
                          const code = getCode(e.currency_id)
                          return (
                            <div key={e.id} className="flex items-center justify-between py-1 group">
                              <div>
                                <span className="text-sm text-gray-300">{e.description}</span>
                                <span className="ml-1.5 text-xs text-gray-600">{e.category}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="text-right">
                                  <div className="text-sm text-white">{formatCurrency(e.amount, code)}</div>
                                  {code !== 'UAH' && <div className="text-xs text-gray-500">{formatUAH(toUAH(e.amount, getRate(e.currency_id)))}</div>}
                                </div>
                                <button onClick={() => startEdit(e)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-white transition-all"><Pencil size={12} /></button>
                                <DeleteButton onDelete={() => handleDelete(e.id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all" />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {expenses.length === 0 && !showForm && <p className="text-gray-500 text-sm text-center py-4">No expenses yet</p>}
              </div>
              {expenses.length > 0 && (
                <div className="flex justify-between items-center pt-1 border-t border-border">
                  <span className="text-sm text-gray-400">Total</span>
                  <span className="text-white font-semibold">{fmt(totalUAH)}</span>
                </div>
              )}
            </div>

            {/* ── Back: chart ── */}
            <div
              className="absolute inset-0"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              {chartData.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No expenses yet</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="relative w-36 h-36 mx-auto rounded-full" style={{ background: gradient }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-[55%] h-[55%] rounded-full bg-card flex flex-col items-center justify-center">
                        <span className="text-xs text-white font-semibold leading-tight text-center px-1">{fmt(totalUAH)}</span>
                        <span className="text-[10px] text-gray-500">total</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {chartData.map(d => {
                      const pct = Math.round((d.uah / totalUAH) * 100)
                      return (
                        <div key={d.category} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                            <span className="text-gray-400 truncate">{d.category}</span>
                            <span className="text-gray-600 flex-shrink-0">{pct}%</span>
                          </div>
                          <span className="text-white ml-2 flex-shrink-0">{fmt(d.uah)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Widget>

      {/* Edit modal */}
      {editItem && (
        <Modal title="Edit Expense" onClose={() => setEditItem(null)}>
          <div className="flex flex-col gap-4">
            <ExpenseFormFields f={editForm} setF={setEditForm} currencies={currencies} allCategories={allCategories} />
            <button onClick={handleEditSave} disabled={!editForm.description || !editForm.amount}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-1">
              Save Changes
            </button>
          </div>
        </Modal>
      )}

      {/* Categories modal */}
      {showCatModal && (
        <Modal title="Manage Categories" onClose={() => setShowCatModal(false)}>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">Default</p>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_TRAVEL_CATEGORIES.map(cat => (
                  <span key={cat} className="px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 text-xs">{cat}</span>
                ))}
              </div>
            </div>
            {userCategories.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Custom</p>
                <div className="flex flex-wrap gap-2">
                  {userCategories.map(cat => (
                    <div key={cat} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 text-white text-xs">
                      {cat}
                      <button onClick={() => deleteCategory(cat)} className="ml-1 text-gray-500 hover:text-red-400 transition-colors"><X size={10} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" placeholder="New category name" value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void addCategory() }}
                className="flex-1 bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
              <button onClick={addCategory} disabled={!newCatName.trim()}
                className="px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-30">
                Add
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
