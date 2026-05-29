import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { Home, Pencil } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { Modal } from '../ui/Modal'
import { formatUAH, currentMonth } from '../../lib/utils'
import type { Currency, ProfileId, FamilyConfig } from '../../types'

interface Props {
  profileId: ProfileId
  currencies: Currency[]
  refreshKey?: number
  onSaved?: () => void
  dragHandle?: ReactNode
}

export function FamilyBudgetWidget({ profileId, currencies, refreshKey, onSaved, dragHandle }: Props) {
  const [config, setConfig] = useState<FamilyConfig | null>(null)
  const [spent, setSpent] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const month = currentMonth()

  const load = useCallback(async () => {
    const endDate = new Date(new Date(month).setMonth(new Date(month).getMonth() + 1))
      .toISOString().slice(0, 10)
    const [{ data: cfg }, { data: items }] = await Promise.all([
      supabase.from('family_config').select('*').eq('profile_id', profileId).maybeSingle(),
      supabase.from('receipt_items').select('total_amount')
        .eq('profile_id', profileId).gte('date', month).lt('date', endDate),
    ])
    setConfig(cfg as FamilyConfig | null)
    setSpent((items ?? []).reduce((s: number, i: { total_amount: number }) => s + i.total_amount, 0))
  }, [profileId, month])

  useEffect(() => { load() }, [load, refreshKey])

  const openEdit = () => {
    setBudgetInput(config ? String(config.monthly_budget) : '')
    setShowModal(true)
  }

  const handleSave = async () => {
    const budget = parseFloat(budgetInput) || 0
    const uahId = currencies.find(c => c.code === 'UAH')?.id ?? 1
    if (config) {
      await supabase.from('family_config').update({
        monthly_budget: budget,
        currency_id: uahId,
        updated_at: new Date().toISOString(),
      }).eq('id', config.id)
    } else {
      await supabase.from('family_config').insert({
        profile_id: profileId,
        monthly_budget: budget,
        currency_id: uahId,
      })
    }
    setShowModal(false)
    load()
    onSaved?.()
  }

  const budget = config?.monthly_budget ?? 0
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0
  const remaining = budget - spent
  const monthName = new Date(month).toLocaleDateString('en', { month: 'long', year: 'numeric' })

  return (
    <>
      <Widget
        title="Family Budget"
        icon={<Home size={14} />}
        dragHandle={dragHandle}
        action={
          <button onClick={openEdit}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors">
            <Pencil size={13} />
          </button>
        }
      >
        {budget > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Spent</span>
              <span className="text-sm text-white font-medium">{formatUAH(spent)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Budget</span>
              <span className="text-sm text-white">{formatUAH(budget)}</span>
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
                <span className={`text-xs font-medium ${remaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {remaining >= 0 ? 'Left: ' : 'Over: '}{formatUAH(Math.abs(remaining))}
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-500 text-center pt-1 border-t border-border">{monthName}</div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm mb-3">Set a monthly budget to track spending</p>
            <button onClick={openEdit}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors">
              Set budget
            </button>
          </div>
        )}
      </Widget>

      {showModal && (
        <Modal title="Monthly Budget" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400">Monthly budget (₴)</label>
              <input
                type="number"
                placeholder="0"
                value={budgetInput}
                onChange={e => setBudgetInput(e.target.value)}
                className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
              />
            </div>
            <button onClick={handleSave}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors">
              Save
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
