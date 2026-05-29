import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Plus, Target, Pencil, X, Check, PlusCircle } from 'lucide-react'
import { DeleteButton } from '../ui/DeleteButton'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { Modal } from '../ui/Modal'
import { formatCurrency } from '../../lib/utils'
import type { Goal, Currency, ProfileId } from '../../types'

interface Props {
  profileId: ProfileId
  currencies: Currency[]
  dragHandle?: ReactNode
}

const EMPTY_FORM = { name: '', type: 'savings', target_amount: '', current_amount: '', currency_id: '1', deadline: '' }
type FormState = typeof EMPTY_FORM

function GoalFormFields({ f, setF, currencies }: {
  f: FormState
  setF: (fn: (prev: FormState) => FormState) => void
  currencies: Currency[]
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">Goal name</label>
        <input type="text" placeholder="e.g. Emergency fund, New laptop" value={f.name}
          onChange={e => setF(p => ({ ...p, name: e.target.value }))}
          className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
      </div>
      <div className="flex gap-2">
        {['savings', 'purchase'].map(type => (
          <button key={type} onClick={() => setF(p => ({ ...p, type }))}
            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${f.type === type ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-400 border-border'}`}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">Target</label>
          <input type="number" placeholder="0" value={f.target_amount}
            onChange={e => setF(p => ({ ...p, target_amount: e.target.value }))}
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
          <label className="text-xs text-gray-400">Already saved</label>
          <input type="number" placeholder="0" value={f.current_amount}
            onChange={e => setF(p => ({ ...p, current_amount: e.target.value }))}
            className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">Deadline (optional)</label>
          <input type="date" value={f.deadline} onChange={e => setF(p => ({ ...p, deadline: e.target.value }))}
            className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
        </div>
      </div>
    </>
  )
}

export function GoalsWidget({ profileId, currencies, dragHandle }: Props) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editItem, setEditItem] = useState<Goal | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null)
  const [depositAmount, setDepositAmount] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('goals').select('*').eq('profile_id', profileId).order('created_at')
    if (data) setGoals(data as Goal[])
  }, [profileId])

  useEffect(() => { load() }, [load])

  const getCode = (id: number) => currencies.find(c => c.id === id)?.code ?? 'UAH'

  const handleAdd = async () => {
    if (!form.name || !form.target_amount) return
    await supabase.from('goals').insert({
      profile_id: profileId, name: form.name, type: form.type,
      target_amount: parseFloat(form.target_amount), current_amount: parseFloat(form.current_amount) || 0,
      currency_id: parseInt(form.currency_id), deadline: form.deadline || null,
    })
    setForm(EMPTY_FORM); setShowModal(false); load()
  }

  const startEdit = (g: Goal) => {
    setEditItem(g)
    setEditForm({ name: g.name, type: g.type, target_amount: String(g.target_amount), current_amount: String(g.current_amount), currency_id: String(g.currency_id), deadline: g.deadline ?? '' })
  }

  const handleEditSave = async () => {
    if (!editItem || !editForm.name || !editForm.target_amount) return
    await supabase.from('goals').update({
      name: editForm.name, type: editForm.type,
      target_amount: parseFloat(editForm.target_amount), current_amount: parseFloat(editForm.current_amount) || 0,
      currency_id: parseInt(editForm.currency_id), deadline: editForm.deadline || null,
    }).eq('id', editItem.id)
    setEditItem(null); load()
  }

  const handleDeposit = async () => {
    if (!depositGoal || !depositAmount) return
    await supabase.from('goals').update({ current_amount: depositGoal.current_amount + parseFloat(depositAmount) }).eq('id', depositGoal.id)
    setDepositGoal(null); setDepositAmount(''); load()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('goals').delete().eq('id', id); load()
  }

  return (
    <>
      <Widget title="Goals" icon={<Target size={14} />} dragHandle={dragHandle}
        action={<button onClick={() => setShowModal(true)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"><Plus size={14} /></button>}>
        <div className="flex flex-col gap-4">
          {goals.map(g => {
            const code = getCode(g.currency_id)
            const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100))
            const isComplete = pct >= 100
            return (
              <div key={g.id} className="group">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium">{g.name}</span>
                      {isComplete && <span className="text-xs text-emerald-400">✓ Done!</span>}
                    </div>
                    {g.deadline && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        By {new Date(g.deadline).toLocaleDateString('en', { month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-300">
                      {formatCurrency(g.current_amount, code)}{' '}
                      <span className="text-gray-500">/ {formatCurrency(g.target_amount, code)}</span>
                    </span>
                    <button onClick={() => { setDepositGoal(g); setDepositAmount('') }}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-emerald-400 transition-all ml-1" title="Add funds">
                      <PlusCircle size={12} />
                    </button>
                    <button onClick={() => startEdit(g)}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition-all" title="Edit goal">
                      <Pencil size={12} />
                    </button>
                    <DeleteButton onDelete={() => handleDelete(g.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all" />
                  </div>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-400' : 'bg-white'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-gray-500 mt-1">{pct}%</div>
              </div>
            )
          })}
          {goals.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No goals yet</p>}
        </div>
      </Widget>

      {showModal && (
        <Modal title="Add Goal" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-4">
            <GoalFormFields f={form} setF={setForm} currencies={currencies} />
            <button onClick={handleAdd} disabled={!form.name || !form.target_amount}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-1">
              Add Goal
            </button>
          </div>
        </Modal>
      )}

      {editItem && (
        <Modal title="Edit Goal" onClose={() => setEditItem(null)}>
          <div className="flex flex-col gap-4">
            <GoalFormFields f={editForm} setF={setEditForm} currencies={currencies} />
            <button onClick={handleEditSave} disabled={!editForm.name || !editForm.target_amount}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-1">
              Save Changes
            </button>
          </div>
        </Modal>
      )}

      {depositGoal && (
        <Modal title={`Add to "${depositGoal.name}"`} onClose={() => setDepositGoal(null)}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400">Amount to add</label>
              <input type="number" placeholder="0" value={depositAmount} autoFocus
                onChange={e => setDepositAmount(e.target.value)}
                className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
            </div>
            <div className="text-sm text-gray-400">
              Current: {formatCurrency(depositGoal.current_amount, getCode(depositGoal.currency_id))}
              {' → '}
              <span className="text-white">{formatCurrency(depositGoal.current_amount + (parseFloat(depositAmount) || 0), getCode(depositGoal.currency_id))}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDepositGoal(null)} className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 border border-border hover:text-white transition-colors flex items-center justify-center gap-1">
                <X size={14} /> Cancel
              </button>
              <button onClick={handleDeposit} disabled={!depositAmount}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-gray-100 transition-colors disabled:opacity-30 flex items-center justify-center gap-1">
                <Check size={14} /> Add
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
