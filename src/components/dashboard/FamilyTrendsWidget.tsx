import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import type { ProfileId, GroceryItem } from '../../types'

interface Props {
  profileId: ProfileId
  refreshKey?: number
  dragHandle?: ReactNode
}

function getLastMonths(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (n - 1 - i))
    return d.toISOString().slice(0, 7) // YYYY-MM
  })
}

export function FamilyTrendsWidget({ profileId, refreshKey, dragHandle }: Props) {
  const [items, setItems] = useState<Pick<GroceryItem, 'category' | 'date' | 'total_amount'>[]>([])
  const months = getLastMonths(3)

  const load = useCallback(async () => {
    const startDate = months[0] + '-01'
    const { data } = await supabase
      .from('receipt_items')
      .select('category, date, total_amount')
      .eq('profile_id', profileId)
      .gte('date', startDate)
    if (data) setItems(data as Pick<GroceryItem, 'category' | 'date' | 'total_amount'>[])
  }, [profileId, months[0]])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load, refreshKey])

  // Build map: category → month → total
  const map: Record<string, Record<string, number>> = {}
  for (const item of items) {
    const m = item.date.slice(0, 7)
    if (!months.includes(m)) continue
    if (!map[item.category]) map[item.category] = {}
    map[item.category][m] = (map[item.category][m] ?? 0) + item.total_amount
  }

  // Sort categories by total spend across all months
  const rows = Object.entries(map)
    .map(([cat, byMonth]) => ({
      category: cat,
      totals: months.map(m => byMonth[m] ?? 0),
      grandTotal: Object.values(byMonth).reduce((s, v) => s + v, 0),
    }))
    .sort((a, b) => b.grandTotal - a.grandTotal)

  const monthLabels = months.map(m =>
    new Date(m + '-15').toLocaleDateString('en', { month: 'short' })
  )

  const prevIdx = months.length - 2
  const curIdx = months.length - 1

  return (
    <Widget title="Spending Trends" icon={<TrendingUp size={14} />} dragHandle={dragHandle}>
      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">Not enough data yet</p>
      ) : (
        <div className="flex flex-col gap-0">
          {/* Header */}
          <div className="flex items-center text-xs text-gray-500 pb-2 border-b border-border">
            <span className="flex-1">Category</span>
            {monthLabels.map((l, i) => (
              <span key={i} className="w-16 text-right">{l}</span>
            ))}
            <span className="w-10 text-right">Δ</span>
          </div>

          {rows.map(row => {
            const prev = row.totals[prevIdx]
            const cur = row.totals[curIdx]
            const delta = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
            const deltaColor = delta === null ? 'text-gray-600'
              : delta > 0 ? 'text-red-400' : delta < 0 ? 'text-emerald-400' : 'text-gray-500'

            return (
              <div key={row.category} className="flex items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                <span className="flex-1 text-gray-300 truncate pr-2">{row.category}</span>
                {row.totals.map((t, i) => (
                  <span key={i} className={`w-16 text-right ${i === curIdx ? 'text-white font-medium' : 'text-gray-500'}`}>
                    {t > 0 ? `₴${Math.round(t)}` : '—'}
                  </span>
                ))}
                <span className={`w-10 text-right font-medium ${deltaColor}`}>
                  {delta === null ? '—' : delta === 0 ? '=' : `${delta > 0 ? '+' : ''}${delta}%`}
                </span>
              </div>
            )
          })}

          {/* Monthly totals row */}
          <div className="flex items-center text-xs pt-2 border-t border-border mt-1">
            <span className="flex-1 text-gray-400 font-medium">Total</span>
            {months.map((m, i) => {
              const t = rows.reduce((s, r) => s + (r.totals[i] ?? 0), 0)
              return (
                <span key={m} className={`w-16 text-right font-semibold ${i === curIdx ? 'text-white' : 'text-gray-400'}`}>
                  {t > 0 ? `₴${Math.round(t)}` : '—'}
                </span>
              )
            })}
            <span className="w-10" />
          </div>
        </div>
      )}
    </Widget>
  )
}
