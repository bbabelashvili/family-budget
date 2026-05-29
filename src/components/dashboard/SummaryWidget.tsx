import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { BarChart3, ArrowDownToLine } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { Modal } from '../ui/Modal'
import { formatUAH, formatCurrency, toUAH, currentMonth } from '../../lib/utils'
import type { Currency, ProfileId, Income, Savings, Subscription, RegularExpense, UnplannedExpense, Debt, TravelConfig } from '../../types'

interface Props {
  profileId: ProfileId
  currencies: Currency[]
  refreshKey: number
  onSaved: () => void
  dragHandle?: ReactNode
}

export function SummaryWidget({ profileId, currencies, refreshKey, onSaved, dragHandle }: Props) {
  const [income, setIncome] = useState<Income[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [regular, setRegular] = useState<RegularExpense[]>([])
  const [unplanned, setUnplanned] = useState<UnplannedExpense[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [savings, setSavings] = useState<Savings[]>([])
  const [travelConfig, setTravelConfig] = useState<TravelConfig | null>(null)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [destination, setDestination] = useState<'savings' | 'travel'>('savings')
  const [selectedSavingsId, setSelectedSavingsId] = useState('')
  const [moveAmount, setMoveAmount] = useState('')
  const month = currentMonth()

  const load = useCallback(async () => {
    const startDate = month
    const endDate = new Date(new Date(month).setMonth(new Date(month).getMonth() + 1))
      .toISOString().slice(0, 10)

    const [
      { data: incomeData },
      { data: subsData },
      { data: regularData },
      { data: unplannedData },
      { data: debtsData },
      { data: savingsData },
      { data: travelData },
    ] = await Promise.all([
      supabase.from('income').select('*').eq('profile_id', profileId).eq('month', month),
      supabase.from('subscriptions').select('*').eq('profile_id', profileId).eq('active', true),
      supabase.from('regular_expenses').select('*').eq('profile_id', profileId).eq('active', true),
      supabase.from('unplanned_expenses').select('*').eq('profile_id', profileId)
        .gte('date', startDate).lt('date', endDate),
      supabase.from('debts').select('*').eq('profile_id', profileId).eq('active', true),
      supabase.from('savings').select('*').eq('profile_id', profileId).order('type'),
      supabase.from('travel_config').select('*').eq('profile_id', 'travels').maybeSingle(),
    ])

    if (incomeData) setIncome(incomeData as Income[])
    if (subsData) setSubs(subsData as Subscription[])
    if (regularData) setRegular(regularData as RegularExpense[])
    if (unplannedData) setUnplanned(unplannedData as UnplannedExpense[])
    if (debtsData) setDebts(debtsData as Debt[])
    if (savingsData) setSavings(savingsData as Savings[])
    setTravelConfig(travelData as TravelConfig | null)
  }, [profileId, month])

  useEffect(() => { load() }, [load, refreshKey])

  const getRate = (currencyId: number) =>
    currencies.find(c => c.id === currencyId)?.exchange_rate ?? 1

  const incomeNetUAH = income.reduce((sum, i) => {
    const net = i.total * (1 - (i.tax_rate ?? 0) / 100)
    return sum + toUAH(net, getRate(i.currency_id))
  }, 0)

  const subsMonthlyUAH = subs.reduce((sum, s) => {
    const uah = toUAH(s.price, getRate(s.currency_id))
    return sum + (s.billing_cycle === 'annual' ? uah / 12 : uah)
  }, 0)

  const regularMonthlyUAH = regular.reduce((sum, e) => {
    const uah = toUAH(e.amount, getRate(e.currency_id))
    return sum + (e.frequency === 'annual' ? uah / 12 : uah)
  }, 0)

  const unplannedUAH = unplanned.reduce((sum, e) =>
    sum + toUAH(e.amount, getRate(e.currency_id)), 0)

  const debtMonthlyUAH = debts.reduce((sum, d) => {
    const uah = toUAH(d.payment_amount, getRate(d.currency_id))
    if (d.billing_cycle === 'weekly') return sum + uah * 52 / 12
    if (d.billing_cycle === 'biweekly') return sum + uah * 26 / 12
    return sum + uah
  }, 0)

  const totalExpenses = subsMonthlyUAH + regularMonthlyUAH + unplannedUAH + debtMonthlyUAH
  const balance = incomeNetUAH - totalExpenses

  const canMove = balance > 0 && (savings.length > 0 || travelConfig !== null)

  const openMoveModal = () => {
    setMoveAmount(balance > 0 ? String(Math.round(balance)) : '')
    setSelectedSavingsId(savings[0]?.id ?? '')
    setDestination(savings.length > 0 ? 'savings' : 'travel')
    setShowMoveModal(true)
  }

  const uahCurrencyId = currencies.find(c => c.code === 'UAH')?.id ?? 1

  const handleMove = async () => {
    const amount = parseFloat(moveAmount)
    if (!amount || amount <= 0) return

    const today = new Date().toISOString().slice(0, 10)

    if (destination === 'savings') {
      if (!selectedSavingsId) return
      const s = savings.find(s => s.id === selectedSavingsId)
      if (!s) return
      await Promise.all([
        supabase.from('savings').update({
          uah_amount: s.uah_amount + amount,
          updated_at: new Date().toISOString(),
        }).eq('id', selectedSavingsId),
        supabase.from('unplanned_expenses').insert({
          profile_id: profileId,
          description: 'Transfer to savings',
          amount,
          currency_id: uahCurrencyId,
          category: 'Other',
          date: today,
        }),
      ])
    } else {
      if (!travelConfig) return
      const travelRate = getRate(travelConfig.currency_id ?? 0)
      const addedInTravelCurrency = travelRate > 0 ? amount / travelRate : 0
      await Promise.all([
        supabase.from('travel_config').update({
          budget_amount: travelConfig.budget_amount + addedInTravelCurrency,
          updated_at: new Date().toISOString(),
        }).eq('id', travelConfig.id),
        supabase.from('unplanned_expenses').insert({
          profile_id: profileId,
          description: 'Transfer to travel budget',
          amount,
          currency_id: uahCurrencyId,
          category: 'Other',
          date: today,
        }),
      ])
    }

    setShowMoveModal(false)
    setMoveAmount('')
    onSaved()
  }

  const rows = [
    { label: 'Net income', value: incomeNetUAH, sign: '+' as const },
    { label: 'Subscriptions', value: subsMonthlyUAH, sign: '−' as const },
    { label: 'Regular expenses', value: regularMonthlyUAH, sign: '−' as const },
    { label: 'Debt payments', value: debtMonthlyUAH, sign: '−' as const },
    { label: 'Unplanned', value: unplannedUAH, sign: '−' as const },
  ].filter(r => r.value > 0)

  const travelCode = currencies.find(c => c.id === travelConfig?.currency_id)?.code ?? 'UAH'
  const travelRate = getRate(travelConfig?.currency_id ?? 0)
  const moveAmountNum = parseFloat(moveAmount) || 0
  const travelPreview = travelRate > 0 ? moveAmountNum / travelRate : 0

  return (
    <>
      <Widget
        title="Monthly Summary"
        icon={<BarChart3 size={14} />}
        dragHandle={dragHandle}
        action={canMove ? (
          <button
            onClick={openMoveModal}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors"
          >
            <ArrowDownToLine size={12} />
            Save
          </button>
        ) : undefined}
      >
        <div className="flex flex-col gap-2">
          {rows.map(row => (
            <div key={row.label} className="flex justify-between items-center">
              <span className="text-sm text-gray-400">{row.label}</span>
              <span className={`text-sm font-medium ${row.sign === '+' ? 'text-white' : 'text-gray-300'}`}>
                {row.sign}{formatUAH(row.value)}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2 border-t border-border mt-1">
            <span className="text-sm font-semibold text-white">Balance</span>
            <span className={`text-sm font-bold ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {balance >= 0 ? '' : '−'}{formatUAH(Math.abs(balance))}
            </span>
          </div>
        </div>
      </Widget>

      {showMoveModal && (
        <Modal title="Move Balance" onClose={() => setShowMoveModal(false)}>
          <div className="flex flex-col gap-4">
            <div className="text-sm text-gray-400">
              Available balance:{' '}
              <span className="text-emerald-400 font-medium">{formatUAH(balance)}</span>
            </div>

            {/* Destination toggle — only show if both options exist */}
            {savings.length > 0 && travelConfig && (
              <div className="flex rounded-xl overflow-hidden border border-border">
                <button
                  onClick={() => setDestination('savings')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${destination === 'savings' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                >
                  Savings
                </button>
                <button
                  onClick={() => setDestination('travel')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${destination === 'travel' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                >
                  Travel budget
                </button>
              </div>
            )}

            {/* Savings account selector */}
            {destination === 'savings' && savings.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Account</label>
                <select
                  value={selectedSavingsId}
                  onChange={e => setSelectedSavingsId(e.target.value)}
                  className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
                >
                  {savings.map(s => (
                    <option key={s.id} value={s.id} className="bg-card">{s.type}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Travel preview */}
            {destination === 'travel' && travelConfig && moveAmountNum > 0 && (
              <div className="text-xs text-gray-500 bg-white/5 rounded-xl px-3 py-2">
                ≈ {formatCurrency(travelPreview, travelCode)} added to{' '}
                <span className="text-gray-300">{travelConfig.trip_name ?? 'Travel budget'}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400">Amount (₴)</label>
              <input
                type="number"
                placeholder="0"
                value={moveAmount}
                onChange={e => setMoveAmount(e.target.value)}
                className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
              />
            </div>
            <button
              onClick={handleMove}
              disabled={!moveAmount || (destination === 'savings' && !selectedSavingsId)}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Move
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
