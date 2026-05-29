import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { PieChart, List } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { formatUAH, currentMonth } from '../../lib/utils'
import type { ProfileId, GroceryItem } from '../../types'

interface Props {
  profileId: ProfileId
  refreshKey?: number
  dragHandle?: ReactNode
}

const PALETTE = [
  '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6',
  '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#a78bfa',
]

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function donutPath(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, endDeg: number) {
  if (endDeg - startDeg >= 360) endDeg = startDeg + 359.99
  const o1 = polarToCartesian(cx, cy, outerR, startDeg)
  const o2 = polarToCartesian(cx, cy, outerR, endDeg)
  const i1 = polarToCartesian(cx, cy, innerR, endDeg)
  const i2 = polarToCartesian(cx, cy, innerR, startDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M${o1.x} ${o1.y} A${outerR} ${outerR} 0 ${large} 1 ${o2.x} ${o2.y} L${i1.x} ${i1.y} A${innerR} ${innerR} 0 ${large} 0 ${i2.x} ${i2.y} Z`
}

export function FamilyCategoriesWidget({ profileId, refreshKey, dragHandle }: Props) {
  const [items, setItems] = useState<GroceryItem[]>([])
  const [flipped, setFlipped] = useState(false)
  const [activeSegment, setActiveSegment] = useState<number | null>(null)
  const month = currentMonth()

  const load = useCallback(async () => {
    const endDate = new Date(new Date(month).setMonth(new Date(month).getMonth() + 1))
      .toISOString().slice(0, 10)
    const { data } = await supabase
      .from('receipt_items')
      .select('category, total_amount')
      .eq('profile_id', profileId)
      .gte('date', month)
      .lt('date', endDate)
    if (data) setItems(data as GroceryItem[])
  }, [profileId, month])

  useEffect(() => { load() }, [load, refreshKey])

  const categoryMap = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.category] = (acc[i.category] ?? 0) + i.total_amount
    return acc
  }, {})

  const data = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([category, total], i) => ({ category, total, color: PALETTE[i % PALETTE.length] }))

  const totalAll = data.reduce((s, d) => s + d.total, 0)
  const monthName = new Date(month).toLocaleDateString('en', { month: 'long' })

  const handleFlip = () => { setFlipped(f => !f); setActiveSegment(null) }

  // Build SVG paths
  let cumDeg = 0
  const segments = data.map((d, i) => {
    const pct = d.total / totalAll
    const startDeg = cumDeg
    const endDeg = cumDeg + pct * 360
    cumDeg = endDeg
    return { ...d, i, pct, startDeg, endDeg, path: donutPath(64, 64, 56, 32, startDeg, endDeg) }
  })

  const active = activeSegment !== null ? data[activeSegment] : null

  return (
    <Widget
      title={flipped ? 'By Category (chart)' : 'By Category'}
      icon={flipped ? <List size={14} /> : <PieChart size={14} />}
      dragHandle={dragHandle}
      action={
        <button
          onClick={handleFlip}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
          title={flipped ? 'Show list' : 'Show chart'}
        >
          {flipped ? <List size={13} /> : <PieChart size={13} />}
        </button>
      }
    >
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No receipts in {monthName}</p>
      ) : (
        <div style={{ perspective: '1000px' }}>
          <div
            className="transition-transform duration-500"
            style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)', display: 'grid' }}
          >
            {/* Front — list */}
            <div style={{ backfaceVisibility: 'hidden', gridArea: '1 / 1' }}>
              <div className="flex flex-col gap-1.5">
                {data.map(d => {
                  const pct = Math.round((d.total / totalAll) * 100)
                  return (
                    <div key={d.category} className="flex items-center justify-between text-xs">
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-gray-300 truncate">{d.category}</span>
                      </div>
                      <span className="w-9 text-right flex-shrink-0 text-gray-500">{pct}%</span>
                      <span className="w-16 text-right flex-shrink-0 text-white">{formatUAH(d.total)}</span>
                    </div>
                  )
                })}
                <div className="flex justify-between items-center pt-2 border-t border-border mt-1 text-xs">
                  <span className="text-gray-400">{monthName} total</span>
                  <span className="text-white font-semibold">{formatUAH(totalAll)}</span>
                </div>
              </div>
            </div>

            {/* Back — interactive SVG donut */}
            <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', gridArea: '1 / 1' }}>
              <div className="flex flex-col gap-3">

                {/* Chart */}
                <div className="relative w-36 h-36 mx-auto">
                  <svg viewBox="0 0 128 128" className="w-full h-full">
                    {segments.map(seg => (
                      <path
                        key={seg.category}
                        d={seg.path}
                        fill={seg.color}
                        onClick={() => setActiveSegment(activeSegment === seg.i ? null : seg.i)}
                        style={{
                          cursor: 'pointer',
                          opacity: activeSegment !== null && activeSegment !== seg.i ? 0.35 : 1,
                          transition: 'opacity 0.15s',
                        }}
                      />
                    ))}
                  </svg>
                  {/* Center hole — tap to deselect */}
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    onClick={() => setActiveSegment(null)}
                    style={{ cursor: active ? 'pointer' : 'default' }}
                  >
                    <div className="w-[52%] h-[52%] rounded-full bg-card flex flex-col items-center justify-center text-center px-1 pointer-events-none">
                      {active ? (
                        <>
                          <span className="text-[9px] text-white font-semibold leading-tight">{formatUAH(active.total)}</span>
                          <span className="text-[9px] text-emerald-400 font-medium">{Math.round((active.total / totalAll) * 100)}%</span>
                          <span className="text-[6.5px] text-gray-400 leading-tight w-full text-center overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {active.category}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-white font-semibold leading-tight">{formatUAH(totalAll)}</span>
                          <span className="text-[10px] text-gray-500">{monthName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Legend — all categories, scrollable */}
                <div className="flex flex-col gap-0.5">
                  {data.map((d, i) => {
                    const pct = Math.round((d.total / totalAll) * 100)
                    const isActive = activeSegment === i
                    return (
                      <div
                        key={d.category}
                        className={`flex items-center justify-between text-xs rounded px-1 py-0.5 cursor-pointer transition-colors ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                        onClick={() => setActiveSegment(isActive ? null : i)}
                      >
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className={`truncate ${isActive ? 'text-white' : 'text-gray-400'}`}>{d.category}</span>
                        </div>
                        <span className={`w-9 text-right flex-shrink-0 ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>{pct}%</span>
                        <span className={`w-16 text-right flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-300'}`}>{formatUAH(d.total)}</span>
                      </div>
                    )
                  })}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </Widget>
  )
}
