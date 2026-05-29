import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Plus, TrendingUp, Pencil } from 'lucide-react'
import { DeleteButton } from '../ui/DeleteButton'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { Modal } from '../ui/Modal'
import { formatUAH, formatCurrency, toUAH, currentMonth } from '../../lib/utils'
import type { Income, Currency, ProfileId } from '../../types'

interface Props {
  profileId: ProfileId
  currencies: Currency[]
  onSaved?: () => void
  dragHandle?: ReactNode
}

const EMPTY_FORM = { source: '', total: '', currency_id: '2', tax_rate: '0' }
type FormState = typeof EMPTY_FORM

// ── Form component at module scope (avoids remount-on-keystroke bug) ──────────
function IncomeFormFields({
  f, setF, currencies,
}: {
  f: FormState
  setF: (fn: (prev: FormState) => FormState) => void
  currencies: Currency[]
}) {
  const previewCode = currencies.find(c => c.id === parseInt(f.currency_id))?.code ?? 'USD'
  const taxPct = parseFloat(f.tax_rate) || 0
  const gross = parseFloat(f.total) || 0
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">Source</label>
        <input type="text" placeholder="e.g. Salary, Freelance" value={f.source}
          onChange={e => setF(p => ({ ...p, source: e.target.value }))}
          className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">Gross amount</label>
          <input type="number" placeholder="0" value={f.total}
            onChange={e => setF(p => ({ ...p, total: e.target.value }))}
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
        <label className="text-xs text-gray-400">Tax rate (%)</label>
        <input type="number" placeholder="0" min="0" max="100" value={f.tax_rate}
          onChange={e => setF(p => ({ ...p, tax_rate: e.target.value }))}
          className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
      </div>
      {gross > 0 && taxPct > 0 && (
        <div className="bg-white/5 rounded-xl px-3 py-2 text-sm text-gray-400">
          Net after tax:{' '}
          <span className="text-white font-medium">{formatCurrency(gross * (1 - taxPct / 100), previewCode)}</span>
        </div>
      )}
    </>
  )
}

// ── Widget ────────────────────────────────────────────────────────────────────
export function IncomeWidget({ profileId, currencies, onSaved, dragHandle }: Props) {
  const [income, setIncome] = useState<Income[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editItem, setEditItem] = useState<Income | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)
  const month = currentMonth()

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('income').select('*, currency:currencies(*)')
      .eq('profile_id', profileId).eq('month', month).order('created_at')
    if (data) setIncome(data as Income[])
  }, [profileId, month])

  useEffect(() => { load() }, [load])

  const getRate = (id: number) => currencies.find(c => c.id === id)?.exchange_rate ?? 1

  const handleAdd = async () => {
    if (!form.source || !form.total) return
    await supabase.from('income').insert({
      profile_id: profileId, source: form.source,
      total: parseFloat(form.total), currency_id: parseInt(form.currency_id),
      tax_rate: parseFloat(form.tax_rate) || 0, month,
    })
    setForm(EMPTY_FORM); setShowModal(false); load(); onSaved?.()
  }

  const startEdit = (i: Income) => {
    setEditItem(i)
    setEditForm({ source: i.source, total: String(i.total), currency_id: String(i.currency_id), tax_rate: String(i.tax_rate ?? 0) })
  }

  const handleEditSave = async () => {
    if (!editItem || !editForm.source || !editForm.total) return
    await supabase.from('income').update({
      source: editForm.source, total: parseFloat(editForm.total),
      currency_id: parseInt(editForm.currency_id), tax_rate: parseFloat(editForm.tax_rate) || 0,
    }).eq('id', editItem.id)
    setEditItem(null); load(); onSaved?.()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('income').delete().eq('id', id); load(); onSaved?.()
  }

  const totalNetUAH = income.reduce((sum, i) => {
    const net = i.total * (1 - (i.tax_rate ?? 0) / 100)
    return sum + toUAH(net, getRate(i.currency_id))
  }, 0)

  return (
    <>
      <Widget title="Income" icon={<TrendingUp size={14} />} dragHandle={dragHandle}
        action={<button onClick={() => setShowModal(true)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"><Plus size={14} /></button>}>
        <div className="flex flex-col gap-1">
          {income.map(i => {
            const rate = getRate(i.currency_id)
            const code = currencies.find(c => c.id === i.currency_id)?.code ?? 'USD'
            const taxRate = i.tax_rate ?? 0
            const net = i.total * (1 - taxRate / 100)
            return (
              <div key={i.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 group">
                <div>
                  <span className="text-sm text-gray-300">{i.source}</span>
                  {taxRate > 0 && <div className="text-xs text-gray-600 mt-0.5">{taxRate}% tax</div>}
                </div>
                <div className="flex items-center gap-2">
                  <DeleteButton onDelete={() => handleDelete(i.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all" />
                  <button onClick={() => startEdit(i)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-all"><Pencil size={12} /></button>
                  <div className="text-right">
                    <div className="text-sm text-white font-medium">{formatCurrency(i.total, code)}</div>
                    {taxRate > 0 && <div className="text-xs text-gray-500">net {formatCurrency(net, code)}</div>}
                    {code !== 'UAH' && <div className="text-xs text-gray-400">{formatUAH(toUAH(net, rate))}</div>}
                  </div>
                </div>
              </div>
            )
          })}
          {income.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No income yet</p>}
        </div>
        {income.length > 0 && (
          <div className="flex justify-between items-center pt-1 border-t border-border">
            <span className="text-sm text-gray-400">Net total</span>
            <span className="text-white font-semibold">{formatUAH(totalNetUAH)}</span>
          </div>
        )}
      </Widget>

      {showModal && (
        <Modal title="Add Income" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-4">
            <IncomeFormFields f={form} setF={setForm} currencies={currencies} />
            <button onClick={handleAdd} disabled={!form.source || !form.total}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              Add Income
            </button>
          </div>
        </Modal>
      )}

      {editItem && (
        <Modal title="Edit Income" onClose={() => setEditItem(null)}>
          <div className="flex flex-col gap-4">
            <IncomeFormFields f={editForm} setF={setEditForm} currencies={currencies} />
            <button onClick={handleEditSave} disabled={!editForm.source || !editForm.total}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              Save Changes
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
