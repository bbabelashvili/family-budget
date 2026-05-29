import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { PieChart } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { formatCurrency, formatUAH, toUAH } from '../../lib/utils'
import type { TravelExpense, Currency, ProfileId } from '../../types'

interface Props {
  profileId: ProfileId
  currencies: Currency[]
  displayCurrencyId?: number
  refreshKey: number
  dragHandle?: ReactNode
}

const PALETTE = [
  '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6',
  '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#a78bfa',
]

export function ExpenseBreakdownWidget({ profileId, currencies, displayCurrencyId, refreshKey, dragHandle }: Props) {
  const [expenses, setExpenses] = useState<TravelExpense[]>([])

  const getRate = useCallback((id: number) => currencies.find(c => c.id === id)?.exchange_rate ?? 1, [currencies])

  const load = useCallback(async () => {
    const { data } = await supabase.from('travel_expenses').select('*').eq('profile_id', profileId)
    if (data) setExpenses(data as TravelExpense[])
  }, [profileId])

  useEffect(() => { load() }, [load, refreshKey])

  const displayRate = displayCurrencyId ? (currencies.find(c => c.id === displayCurrencyId)?.exchange_rate ?? 1) : 1
  const displayCode = displayCurrencyId ? (currencies.find(c => c.id === displayCurrencyId)?.code ?? 'UAH') : 'UAH'

  // Group by category and sum in UAH
  const categoryMap = expenses.reduce<Record<string, number>>((acc, e) => {
    const uah = toUAH(e.amount, getRate(e.currency_id))
    acc[e.category] = (acc[e.category] ?? 0) + uah
    return acc
  }, {})

  const data = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([category, uah], i) => ({
      category,
      uah,
      display: displayCurrencyId ? uah / displayRate : uah,
      color: PALETTE[i % PALETTE.length],
    }))

  const totalUAH = data.reduce((s, d) => s + d.uah, 0)
  const totalDisplay = displayCurrencyId ? totalUAH / displayRate : totalUAH

  // Build conic-gradient
  let cumPct = 0
  const gradient = data.length > 0
    ? `conic-gradient(${data.map(d => {
        const pct = (d.uah / totalUAH) * 100
        const part = `${d.color} ${cumPct.toFixed(2)}% ${(cumPct + pct).toFixed(2)}%`
        cumPct += pct
        return part
      }).join(', ')})`
    : 'conic-gradient(#ffffff20 0% 100%)'

  return (
    <Widget title="By Category" icon={<PieChart size={14} />} dragHandle={dragHandle}>
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No expenses yet</p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Donut chart */}
          <div className="relative w-36 h-36 mx-auto rounded-full" style={{ background: gradient }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[55%] h-[55%] rounded-full bg-card flex flex-col items-center justify-center">
                <span className="text-xs text-white font-semibold leading-tight">
                  {displayCurrencyId ? formatCurrency(totalDisplay, displayCode) : formatUAH(totalUAH)}
                </span>
                <span className="text-[10px] text-gray-500">total</span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-2">
            {data.map(d => {
              const pct = Math.round((d.uah / totalUAH) * 100)
              return (
                <div key={d.category} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-gray-400 truncate">{d.category}</span>
                    <span className="text-gray-600 flex-shrink-0">{pct}%</span>
                  </div>
                  <span className="text-white ml-2 flex-shrink-0">
                    {displayCurrencyId ? formatCurrency(d.display, displayCode) : formatUAH(d.uah)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Widget>
  )
}
