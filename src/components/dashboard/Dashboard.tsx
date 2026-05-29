import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { LogOut, GripVertical, Maximize2, Minimize2 } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import { IncomeWidget } from './IncomeWidget'
import { SavingsWidget } from './SavingsWidget'
import { CurrencyWidget } from './CurrencyWidget'
import { SubscriptionsWidget } from './SubscriptionsWidget'
import { RegularExpensesWidget } from './RegularExpensesWidget'
import { UnplannedExpensesWidget } from './UnplannedExpensesWidget'
import { GoalsWidget } from './GoalsWidget'
import { SummaryWidget } from './SummaryWidget'
import { DebtWidget } from './DebtWidget'
import { TripSummaryWidget } from './TripSummaryWidget'
import { AccommodationWidget } from './AccommodationWidget'
import { TransportWidget } from './TransportWidget'
import { TravelExpensesWidget } from './TravelExpensesWidget'
import { ShoppingWidget } from './ShoppingWidget'
import { ReceiptScannerWidget } from './ReceiptScannerWidget'
import { FamilyBudgetWidget } from './FamilyBudgetWidget'
import { FamilyCategoriesWidget } from './FamilyCategoriesWidget'
import { FamilyTrendsWidget } from './FamilyTrendsWidget'
import type { Currency, ProfileId } from '../../types'

interface Props {
  profileId: ProfileId
  onLogout: () => void
}

const PROFILE_LABELS: Record<string, string> = { mine: 'Bao Yob 🦅', hers: 'Bao 🐥', travels: 'Travels', shared: 'Family' }
const PROFILE_COLORS: Record<string, string> = { mine: 'text-gray-700', hers: 'text-purple-700', travels: 'text-amber-800', shared: 'text-emerald-800' }
const PROFILE_BG: Record<string, string> = { mine: '#D9D9D9', hers: '#AA98A9', shared: '#EDE8D0', travels: '#BBB791' }
// Card/border tinted to each profile: 70% black + 30% profile bg hue
const PROFILE_CARD: Record<string, string> = { mine: '#3D3D3D', hers: '#322B35', shared: '#333330', travels: '#2F3024' }
const PROFILE_BORDER: Record<string, string> = { mine: '#525252', shared: '#484845', hers: '#4A4050', travels: '#464738' }
const DEFAULT_ORDER = ['summary', 'income', 'currency', 'savings', 'subscriptions', 'regular', 'unplanned', 'debt', 'goals']
const SHARED_DEFAULT_ORDER = ['family-budget', 'receipt-scanner', 'family-categories', 'family-trends']
const TRAVEL_DEFAULT_ORDER = ['trip-summary', 'accommodation', 'transport', 'travel-expenses', 'shopping']

function getDefaultOrder(profileId: string): string[] {
  if (profileId === 'travels') return TRAVEL_DEFAULT_ORDER
  if (profileId === 'shared') return SHARED_DEFAULT_ORDER
  return DEFAULT_ORDER
}

function orderKey(profileId: string) { return `budget_layout_${profileId}` }
function spansKey(profileId: string) { return `budget_spans_${profileId}` }

function loadOrder(profileId: string): string[] {
  const defaultOrder = getDefaultOrder(profileId)
  try {
    const saved: string[] = JSON.parse(localStorage.getItem(orderKey(profileId)) ?? 'null')
    if (saved) {
      const merged = saved.filter(id => defaultOrder.includes(id))
      defaultOrder.forEach(id => { if (!merged.includes(id)) merged.push(id) })
      return merged
    }
  } catch { /* ignore */ }
  return [...defaultOrder]
}

function loadSpans(profileId: string): Record<string, 2> {
  try { return JSON.parse(localStorage.getItem(spansKey(profileId)) ?? '{}') } catch { return {} }
}

// ── Sortable item wrapper ─────────────────────────────────────────────────────

function SortableItem({ id, isWide, onToggleWide, children }: {
  id: string
  isWide: boolean
  onToggleWide: () => void
  children: (dragHandle: ReactNode) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const handle = (
    <div className="flex items-center gap-0.5">
      <button
        onClick={onToggleWide}
        className="p-1 rounded text-gray-500 hover:text-gray-300 transition-colors"
        title={isWide ? 'Make narrow' : 'Make wide'}
      >
        {isWide ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
      </button>
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 rounded text-gray-500 hover:text-gray-300 transition-colors touch-none select-none"
        title="Drag to reorder"
      >
        <GripVertical size={14} />
      </div>
    </div>
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? 'opacity-40' : ''} ${isWide ? 'sm:col-span-2' : ''}`}
    >
      {children(handle)}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard({ profileId, onLogout }: Props) {
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => loadOrder(profileId))
  const [wideWidgets, setWideWidgets] = useState<Record<string, 2>>(() => loadSpans(profileId))
  const [travelCurrencyId, setTravelCurrencyId] = useState<number | null>(null)

  const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), [])

  const loadCurrencies = useCallback(async () => {
    const { data } = await supabase.from('currencies').select('*').order('code')
    if (data) setCurrencies(data)
  }, [])

  const loadTravelCurrency = useCallback(async () => {
    if (profileId !== 'travels') return
    const { data } = await supabase.from('travel_config').select('currency_id').eq('profile_id', profileId).maybeSingle()
    if (data?.currency_id) setTravelCurrencyId(data.currency_id)
  }, [profileId])

  useEffect(() => { loadCurrencies() }, [loadCurrencies])
  useEffect(() => { loadTravelCurrency() }, [loadTravelCurrency, refreshKey])

  // Sync body background to profile colour so iOS over-scroll bounce matches
  useEffect(() => {
    const bg = PROFILE_BG[profileId] ?? '#F2F0EF'
    document.body.style.backgroundColor = bg
    return () => { document.body.style.backgroundColor = '' }
  }, [profileId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setWidgetOrder(prev => {
        const next = arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string))
        localStorage.setItem(orderKey(profileId), JSON.stringify(next))
        return next
      })
    }
  }

  const toggleWide = (id: string) => {
    setWideWidgets(prev => {
      const next = { ...prev }
      if (next[id]) delete next[id]
      else next[id] = 2
      localStorage.setItem(spansKey(profileId), JSON.stringify(next))
      return next
    })
  }

  const renderWidget = (id: string, dragHandle: ReactNode): ReactNode => {
    switch (id) {
      case 'summary':     return <SummaryWidget profileId={profileId} currencies={currencies} refreshKey={refreshKey} onSaved={triggerRefresh} dragHandle={dragHandle} />
      case 'income':      return <IncomeWidget profileId={profileId} currencies={currencies} onSaved={triggerRefresh} dragHandle={dragHandle} />
      case 'currency':    return <CurrencyWidget currencies={currencies} onUpdate={loadCurrencies} dragHandle={dragHandle} />
      case 'savings':     return <SavingsWidget profileId={profileId} currencies={currencies} refreshKey={refreshKey} dragHandle={dragHandle} />
      case 'subscriptions': return <SubscriptionsWidget profileId={profileId} currencies={currencies} onSaved={triggerRefresh} dragHandle={dragHandle} />
      case 'regular':     return <RegularExpensesWidget profileId={profileId} currencies={currencies} onSaved={triggerRefresh} dragHandle={dragHandle} />
      case 'unplanned':   return <UnplannedExpensesWidget profileId={profileId} currencies={currencies} refreshKey={refreshKey} onSaved={triggerRefresh} dragHandle={dragHandle} />
      case 'debt':        return <DebtWidget profileId={profileId} currencies={currencies} onSaved={triggerRefresh} dragHandle={dragHandle} />
      case 'goals':         return <GoalsWidget profileId={profileId} currencies={currencies} dragHandle={dragHandle} />
      case 'trip-summary':      return <TripSummaryWidget profileId={profileId} currencies={currencies} refreshKey={refreshKey} onSaved={triggerRefresh} dragHandle={dragHandle} />
      case 'accommodation':     return <AccommodationWidget profileId={profileId} currencies={currencies} displayCurrencyId={travelCurrencyId ?? undefined} onSaved={triggerRefresh} dragHandle={dragHandle} />
      case 'transport':         return <TransportWidget profileId={profileId} currencies={currencies} displayCurrencyId={travelCurrencyId ?? undefined} onSaved={triggerRefresh} dragHandle={dragHandle} />
      case 'travel-expenses':   return <TravelExpensesWidget profileId={profileId} currencies={currencies} displayCurrencyId={travelCurrencyId ?? undefined} onSaved={triggerRefresh} dragHandle={dragHandle} />
      case 'shopping':          return <ShoppingWidget profileId={profileId} dragHandle={dragHandle} />
      case 'receipt-scanner':    return <ReceiptScannerWidget profileId={profileId} currencies={currencies} refreshKey={refreshKey} onSaved={triggerRefresh} dragHandle={dragHandle} />
      case 'family-budget':      return <FamilyBudgetWidget profileId={profileId} currencies={currencies} refreshKey={refreshKey} onSaved={triggerRefresh} dragHandle={dragHandle} />
      case 'family-categories':  return <FamilyCategoriesWidget profileId={profileId} refreshKey={refreshKey} dragHandle={dragHandle} />
      case 'family-trends':      return <FamilyTrendsWidget profileId={profileId} refreshKey={refreshKey} dragHandle={dragHandle} />
      default:              return null
    }
  }

  return (
    <div className="min-h-dvh pb-10" style={{
      backgroundColor: PROFILE_BG[profileId] ?? '#111111',
      '--color-card': PROFILE_CARD[profileId] ?? '#1a1a1a',
      '--color-border': PROFILE_BORDER[profileId] ?? '#2a2a2a',
    } as React.CSSProperties}>
      <header className="sticky top-0 z-10 bg-white/40 backdrop-blur-md border-b border-black/10 px-4 py-3 flex items-center justify-between">
        <span className={`font-semibold ${PROFILE_COLORS[profileId] ?? 'text-gray-900'}`}>
          {PROFILE_LABELS[profileId] ?? profileId}
        </span>
        <button onClick={onLogout} className="p-1.5 rounded-lg hover:bg-black/10 text-gray-500 hover:text-gray-900 transition-colors">
          <LogOut size={16} />
        </button>
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
          <main className="max-w-5xl mx-auto px-4 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {widgetOrder.map(id => (
              <SortableItem key={id} id={id} isWide={!!wideWidgets[id]} onToggleWide={() => toggleWide(id)}>
                {handle => renderWidget(id, handle)}
              </SortableItem>
            ))}
          </main>
        </SortableContext>
      </DndContext>
    </div>
  )
}
