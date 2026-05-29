import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Map, Pencil } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { Modal } from '../ui/Modal'
import { formatCurrency, formatUAH, toUAH } from '../../lib/utils'
import type { TravelConfig, Currency, ProfileId } from '../../types'

interface Props {
  profileId: ProfileId
  currencies: Currency[]
  refreshKey: number
  onSaved?: () => void
  dragHandle?: ReactNode
}

export function TripSummaryWidget({ profileId, currencies, refreshKey, onSaved, dragHandle }: Props) {
  const [config, setConfig] = useState<TravelConfig | null>(null)
  const [totalUAH, setTotalUAH] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ trip_name: '', budget_amount: '', currency_id: '2', start_date: '', end_date: '' })

  const getRate = useCallback((id: number) => currencies.find(c => c.id === id)?.exchange_rate ?? 1, [currencies])

  const load = useCallback(async () => {
    const [{ data: cfg }, { data: acc }, { data: trans }, { data: exp }] = await Promise.all([
      supabase.from('travel_config').select('*').eq('profile_id', profileId).maybeSingle(),
      supabase.from('travel_accommodations').select('amount, currency_id').eq('profile_id', profileId),
      supabase.from('travel_transport').select('amount, currency_id').eq('profile_id', profileId),
      supabase.from('travel_expenses').select('amount, currency_id').eq('profile_id', profileId),
    ])
    setConfig(cfg as TravelConfig | null)
    const sum = (rows: { amount: number; currency_id: number }[] | null) =>
      (rows ?? []).reduce((s, r) => s + toUAH(r.amount, getRate(r.currency_id)), 0)
    setTotalUAH(sum(acc) + sum(trans) + sum(exp))
  }, [profileId, getRate])

  useEffect(() => { load() }, [load, refreshKey])

  const budgetRate = getRate(config?.currency_id ?? 0)
  const budgetUAH = config ? toUAH(config.budget_amount, budgetRate) : 0
  const budgetCode = currencies.find(c => c.id === config?.currency_id)?.code ?? 'UAH'
  const pct = budgetUAH > 0 ? Math.min(100, Math.round((totalUAH / budgetUAH) * 100)) : 0
  const remainingUAH = budgetUAH - totalUAH
  const spentDisplay = budgetRate > 0 ? totalUAH / budgetRate : 0
  const remainingDisplay = budgetRate > 0 ? remainingUAH / budgetRate : 0

  const openEdit = () => {
    setForm({
      trip_name: config?.trip_name ?? '',
      budget_amount: config ? String(config.budget_amount) : '',
      currency_id: config?.currency_id ? String(config.currency_id) : '2',
      start_date: config?.start_date ?? '',
      end_date: config?.end_date ?? '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    const payload = {
      profile_id: profileId,
      trip_name: form.trip_name || null,
      budget_amount: parseFloat(form.budget_amount) || 0,
      currency_id: parseInt(form.currency_id),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      updated_at: new Date().toISOString(),
    }
    if (config) {
      await supabase.from('travel_config').update(payload).eq('id', config.id)
    } else {
      await supabase.from('travel_config').insert(payload)
    }
    setShowModal(false)
    load(); onSaved?.()
  }

  return (
    <>
      <Widget
        title={config?.trip_name ?? 'Trip Budget'}
        icon={<Map size={14} />}
        dragHandle={dragHandle}
        action={
          <button onClick={openEdit} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors">
            <Pencil size={13} />
          </button>
        }
      >
        {config?.budget_amount ? (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Spent</span>
              <div className="text-right">
                <div className="text-sm text-white font-medium">{formatCurrency(spentDisplay, budgetCode)}</div>
                {budgetCode !== 'UAH' && <div className="text-xs text-gray-500">{formatUAH(totalUAH)}</div>}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Budget</span>
              <span className="text-sm text-white">{formatCurrency(config.budget_amount, budgetCode)}</span>
            </div>
            <div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-red-400' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-gray-500">{pct}% used</span>
                <span className={`text-xs font-medium ${remainingUAH >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {remainingUAH >= 0 ? 'Left: ' : 'Over: '}{formatCurrency(Math.abs(remainingDisplay), budgetCode)}
                </span>
              </div>
            </div>
            {(config.start_date || config.end_date) && (
              <div className="text-xs text-gray-500 text-center pt-1 border-t border-border">
                {config.start_date && new Date(config.start_date).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
                {config.start_date && config.end_date && ' → '}
                {config.end_date && new Date(config.end_date).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm mb-3">Set a trip budget to get started</p>
            <button onClick={openEdit} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors">
              Set budget
            </button>
          </div>
        )}
      </Widget>

      {showModal && (
        <Modal title="Trip Settings" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400">Trip name (optional)</label>
              <input type="text" placeholder="e.g. Paris Summer 2026" value={form.trip_name}
                onChange={e => setForm(p => ({ ...p, trip_name: e.target.value }))}
                className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Budget</label>
                <input type="number" placeholder="0" value={form.budget_amount}
                  onChange={e => setForm(p => ({ ...p, budget_amount: e.target.value }))}
                  className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Currency</label>
                <select value={form.currency_id} onChange={e => setForm(p => ({ ...p, currency_id: e.target.value }))}
                  className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
                  {currencies.map(c => <option key={c.id} value={c.id} className="bg-card">{c.code}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Start date</label>
                <input type="date" value={form.start_date}
                  onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">End date</label>
                <input type="date" value={form.end_date}
                  onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                  className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
              </div>
            </div>
            <button onClick={handleSave}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors mt-1">
              Save
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
