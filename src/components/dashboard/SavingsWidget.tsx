import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Plus, PiggyBank, Pencil, Check, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { Modal } from '../ui/Modal'
import { formatUAH } from '../../lib/utils'
import type { Currency, Savings, ProfileId } from '../../types'

interface Props {
  profileId: ProfileId
  currencies: Currency[]
  refreshKey?: number
  dragHandle?: ReactNode
}

export function SavingsWidget({ profileId, currencies, refreshKey, dragHandle }: Props) {
  const [savings, setSavings] = useState<Savings[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVals, setEditVals] = useState({ uah_amount: '', usd_amount: '', eur_amount: '' })
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ type: '', uah_amount: '', usd_amount: '', eur_amount: '' })

  const load = useCallback(async () => {
    const { data } = await supabase.from('savings').select('*').eq('profile_id', profileId).order('type')
    if (data) setSavings(data)
  }, [profileId])

  useEffect(() => { load() }, [load, refreshKey])

  const usdRate = currencies.find(c => c.code === 'USD')?.exchange_rate ?? 41
  const eurRate = currencies.find(c => c.code === 'EUR')?.exchange_rate ?? 44

  const toUAHTotal = (s: Savings) =>
    s.uah_amount + s.usd_amount * usdRate + s.eur_amount * eurRate

  const grandTotal = savings.reduce((sum, s) => sum + toUAHTotal(s), 0)

  const startEdit = (s: Savings) => {
    setEditingId(s.id)
    setEditVals({ uah_amount: String(s.uah_amount), usd_amount: String(s.usd_amount), eur_amount: String(s.eur_amount) })
  }

  const saveEdit = async (id: string) => {
    await supabase.from('savings').update({
      uah_amount: parseFloat(editVals.uah_amount) || 0,
      usd_amount: parseFloat(editVals.usd_amount) || 0,
      eur_amount: parseFloat(editVals.eur_amount) || 0,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setEditingId(null)
    load()
  }

  const handleAdd = async () => {
    if (!form.type) return
    await supabase.from('savings').insert({
      profile_id: profileId,
      type: form.type,
      uah_amount: parseFloat(form.uah_amount) || 0,
      usd_amount: parseFloat(form.usd_amount) || 0,
      eur_amount: parseFloat(form.eur_amount) || 0,
    })
    setForm({ type: '', uah_amount: '', usd_amount: '', eur_amount: '' })
    setShowModal(false)
    load()
  }

  return (
    <>
      <Widget
        title="Savings"
        icon={<PiggyBank size={14} />}
        dragHandle={dragHandle}
        action={
          <button onClick={() => setShowModal(true)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors">
            <Plus size={14} />
          </button>
        }
      >
        <div className="flex flex-col gap-2">
          {savings.map(s => (
            <div key={s.id} className="border border-border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{s.type}</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-emerald-400 font-medium">{formatUAH(toUAHTotal(s))}</span>
                  {editingId === s.id ? (
                    <>
                      <button onClick={() => saveEdit(s.id)} className="text-emerald-400 hover:text-emerald-300 transition-colors ml-1">
                        <Check size={13} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-300 transition-colors">
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => startEdit(s)} className="text-gray-600 hover:text-gray-300 transition-colors ml-1">
                      <Pencil size={12} />
                    </button>
                  )}
                </div>
              </div>

              {editingId === s.id ? (
                <div className="grid grid-cols-3 gap-2">
                  {(['uah_amount', 'usd_amount', 'eur_amount'] as const).map((field, i) => (
                    <div key={field}>
                      <label className="text-xs text-gray-500">{['₴ UAH', '$ USD', '€ EUR'][i]}</label>
                      <input
                        type="number"
                        value={editVals[field]}
                        onChange={e => setEditVals(v => ({ ...v, [field]: e.target.value }))}
                        className="w-full mt-1 bg-white/5 border border-border rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-white/30"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex gap-3 text-xs text-gray-500">
                  {s.uah_amount > 0 && <span>₴{s.uah_amount.toLocaleString()}</span>}
                  {s.usd_amount > 0 && <span>${s.usd_amount.toLocaleString()}</span>}
                  {s.eur_amount > 0 && <span>€{s.eur_amount.toLocaleString()}</span>}
                  {s.uah_amount === 0 && s.usd_amount === 0 && s.eur_amount === 0 && (
                    <span className="text-gray-600">empty</span>
                  )}
                </div>
              )}
            </div>
          ))}
          {savings.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No savings yet</p>}
        </div>

        {savings.length > 0 && (
          <div className="flex justify-between items-center pt-1 border-t border-border">
            <span className="text-sm text-gray-400">Total</span>
            <span className="text-emerald-400 font-semibold">{formatUAH(grandTotal)}</span>
          </div>
        )}
      </Widget>

      {showModal && (
        <Modal title="Add Savings Account" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400">Type</label>
              <input
                type="text"
                placeholder="e.g. Cash, Monobank, Crypto"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['uah_amount', 'usd_amount', 'eur_amount'] as const).map((field, i) => (
                <div key={field} className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-400">{['₴ UAH', '$ USD', '€ EUR'][i]}</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={handleAdd}
              disabled={!form.type}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
