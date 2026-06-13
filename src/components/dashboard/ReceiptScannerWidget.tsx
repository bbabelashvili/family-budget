import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { Camera, X, Loader2, ChevronDown, ChevronUp, Plus, Pencil } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { Modal } from '../ui/Modal'
import type { Currency, ProfileId, GroceryItem } from '../../types'

export const GROCERY_CATEGORIES = [
  'Фрукти/ягоди', 'Зелень', 'Овочі', 'Мʼясо', 'Риба', 'Птиця',
  'Снеки', 'Хімія/папір/серветки', 'Вода', 'Напої', 'ОСББ/Комуналка',
  'Крупи', 'Жири', 'Молочка', 'Соуси', 'Алкоголь', 'Для дому',
  'PesDog', 'Хліб/Випічка', 'Спеції', 'Ванда P0', 'Ванда Всяке', 'Ванда Vet', 'Інше',
]

const VENDORS = ['Метро', 'Сільпо', 'Ашан', 'Базар', 'Egersund', 'Rozetka', 'Avalon', 'Доставки', 'Watershop', 'Інше']

const MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-haiku-4-5',  label: 'Haiku 4.5'  },
] as const

type ModelId = typeof MODELS[number]['id']

// Individual line item returned by AI
type ParsedItem = { name: string; category: string; total: number }
// Full receipt from AI
type ParsedReceipt = { vendor: string; date: string; items: ParsedItem[] }
// Saved receipt group for display
type ReceiptGroup = { key: string; date: string; vendor: string; items: GroceryItem[]; total: number }

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(note?: string): string {
  return `Parse this grocery receipt and return JSON only (no markdown, no explanation).

Categories: ${GROCERY_CATEGORIES.join(', ')}

Known vendors: ${VENDORS.join(', ')}

STEP 1 — Identify vendor: read the store name from the receipt and match it to the known vendors list.

STEP 2 — Apply pricing rule based on vendor:
  • If vendor is "Метро" (Metro Cash & Carry): prices on each line are WITHOUT VAT. For every item: total = printed_price × 1.2. Example: printed 83.25 → write 99.90.
  • For ALL other vendors (Сільпо, Ашан, Egersund, etc.): prices already include VAT. Use the printed total as-is. Do NOT multiply by 1.2.

STEP 3 — Extract every product line item and assign the best matching category.

JSON format:
{
  "vendor": "vendor from the known list",
  "date": "YYYY-MM-DD",
  "items": [
    { "name": "item name in original language", "category": "category", "total": 0.00 }
  ]
}

Exclude: VAT summary line, receipt totals, service charges, loyalty points, payment lines.${note ? `\n\nExtra context: ${note}` : ''}`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractJson(text: string): ParsedReceipt {
  // Strip markdown code fences if present
  const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (fenced) return JSON.parse(fenced[1]) as ParsedReceipt
  // Fall back to first {...} block
  const bare = text.match(/\{[\s\S]*\}/)
  if (bare) return JSON.parse(bare[0]) as ParsedReceipt
  throw new Error('No JSON in response')
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function parseWithClaude(base64: string, mimeType: string, note: string, modelId: string): Promise<ParsedReceipt> {
  const validMime = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as string[]).includes(mimeType) ? mimeType : 'image/jpeg'
  const res = await fetch('/api/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 4096,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: validMime, data: base64 } },
        { type: 'text', text: buildPrompt(note) },
      ]}],
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? `Claude API error ${res.status}`)
  }
  const data = await res.json() as { content: [{ text: string }] }
  return extractJson(data.content[0].text)
}

// ── Module-scope components ───────────────────────────────────────────────────

function ScanModal({ model, setModel, note, setNote, onScan, onClose }: {
  model: ModelId
  setModel: (m: ModelId) => void
  note: string
  setNote: (n: string) => void
  onScan: () => void
  onClose: () => void
}) {
  return (
    <Modal title="Scan Receipt" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">AI Model</label>
          <div className="flex flex-col gap-1">
            {MODELS.map(m => (
              <button key={m.id} onClick={() => setModel(m.id)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-colors text-sm ${
                  model === m.id ? 'border-white/30 bg-white/10 text-white' : 'border-border text-gray-400 hover:text-gray-300'
                }`}>
                <span>{m.label}</span>
                <span className="text-xs text-gray-400">Anthropic</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">Note <span className="text-gray-600">(optional)</span></label>
          <input type="text" placeholder="e.g. Metro receipt, produce section only"
            value={note} onChange={e => setNote(e.target.value)}
            className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
        </div>
        <button onClick={onScan}
          className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">
          <Camera size={14} />
          Open Camera / Gallery
        </button>
      </div>
    </Modal>
  )
}

// One line item in the preview — category is editable
function PreviewItemRow({ item, onChange, onRemove }: {
  item: ParsedItem
  onChange: (updated: ParsedItem) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="flex-1 text-xs text-gray-300 truncate min-w-0">{item.name}</span>
      <select value={item.category} onChange={e => onChange({ ...item, category: e.target.value })}
        className="w-24 flex-shrink-0 bg-white/5 border border-border rounded px-1.5 py-1 text-xs text-white focus:outline-none">
        {GROCERY_CATEGORIES.map(c => <option key={c} value={c} className="bg-card">{c}</option>)}
      </select>
      <input
        type="number" step="0.01" min="0"
        value={item.total}
        onChange={e => onChange({ ...item, total: parseFloat(e.target.value) || 0 })}
        className="w-16 flex-shrink-0 bg-white/5 border border-border rounded px-1.5 py-1 text-xs text-white text-right focus:outline-none focus:border-white/30"
      />
      <button onClick={onRemove} className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
        <X size={12} />
      </button>
    </div>
  )
}

// ── Manual entry ─────────────────────────────────────────────────────────────

type ManualEntry = { id: number; category: string; amount: string }

const SORTED_CATEGORIES = [...GROCERY_CATEGORIES].sort((a, b) => a.localeCompare(b, 'uk'))

function ManualEntryModal({ onSave, onClose, onDelete, saving, initialVendor, initialDate, initialEntries }: {
  onSave: (vendor: string, date: string, entries: ManualEntry[]) => void
  onClose: () => void
  onDelete?: () => void
  saving: boolean
  initialVendor?: string
  initialDate?: string
  initialEntries?: ManualEntry[]
}) {
  const [vendor, setVendor] = useState(initialVendor ?? 'Інше')
  const [date, setDate] = useState(initialDate ?? new Date().toISOString().slice(0, 10))
  const [entries, setEntries] = useState<ManualEntry[]>(
    initialEntries ?? [{ id: 0, category: SORTED_CATEGORIES[0], amount: '' }]
  )
  const nextId = useRef(initialEntries ? initialEntries.length : 1)

  const addEntry = () => setEntries(prev => [...prev, { id: nextId.current++, category: SORTED_CATEGORIES[0], amount: '' }])
  const removeEntry = (id: number) => setEntries(prev => prev.filter(e => e.id !== id))
  const updateEntry = (id: number, field: keyof Omit<ManualEntry, 'id'>, value: string) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))

  const valid = entries.some(e => parseFloat(e.amount) > 0)

  return (
    <Modal title="Add Expense" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Vendor</label>
            <select value={vendor} onChange={e => setVendor(e.target.value)}
              className="bg-white/5 border border-border rounded-xl px-2 py-1.5 text-white text-sm focus:outline-none">
              {VENDORS.map(v => <option key={v} value={v} className="bg-card">{v}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="bg-white/5 border border-border rounded-xl px-2 py-1.5 text-white text-sm focus:outline-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 max-h-[45vh] overflow-y-auto pr-0.5">
          {entries.map(e => (
            <div key={e.id} className="flex items-center gap-2">
              <select value={e.category} onChange={ev => updateEntry(e.id, 'category', ev.target.value)}
                className="flex-1 min-w-0 bg-white/5 border border-border rounded-xl px-2 py-1.5 text-white text-xs focus:outline-none">
                {SORTED_CATEGORIES.map(c => <option key={c} value={c} className="bg-card">{c}</option>)}
              </select>
              <input type="number" step="0.01" min="0" placeholder="₴0.00"
                value={e.amount} onChange={ev => updateEntry(e.id, 'amount', ev.target.value)}
                className="w-24 bg-white/5 border border-border rounded-xl px-2 py-1.5 text-white text-xs text-right focus:outline-none focus:border-white/30" />
              {entries.length > 1 && (
                <button onClick={() => removeEntry(e.id)} className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
          <button onClick={addEntry}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors pt-0.5">
            <Plus size={11} /> Add category
          </button>
        </div>

        <button onClick={() => onSave(vendor, date, entries)} disabled={!valid || saving}
          className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          {saving ? 'Saving…' : 'Save'}
        </button>
        {onDelete && (
          <button onClick={onDelete} disabled={saving}
            className="text-xs text-red-400 hover:text-red-300 transition-colors text-center disabled:opacity-30">
            Delete receipt
          </button>
        )}
      </div>
    </Modal>
  )
}

// ── Widget ────────────────────────────────────────────────────────────────────

interface Props {
  profileId: ProfileId
  currencies: Currency[]
  refreshKey?: number
  onSaved?: () => void
  dragHandle?: ReactNode
}

const MODEL_KEY = 'budget_receipt_model'

export function ReceiptScannerWidget({ profileId, currencies: _currencies, refreshKey, onSaved, dragHandle }: Props) {
  const [items, setItems] = useState<GroceryItem[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [showScanModal, setShowScanModal] = useState(false)
  const [model, setModel] = useState<ModelId>(() => (localStorage.getItem(MODEL_KEY) as ModelId) ?? 'claude-sonnet-4-6')
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<ParsedReceipt | null>(null)
  const [previewItems, setPreviewItems] = useState<ParsedItem[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualSaving, setManualSaving] = useState(false)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    // Show 3 months of receipts (matches the Trends widget window)
    const start = new Date()
    start.setDate(1)
    start.setMonth(start.getMonth() - 2)
    const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
    const { data } = await supabase
      .from('receipt_items').select('*').eq('profile_id', profileId)
      .gte('date', startDate).order('date', { ascending: false }).order('created_at', { ascending: false })
    if (data) setItems(data as GroceryItem[])
  }, [profileId])

  useEffect(() => { load() }, [load, refreshKey])

  const handleModelChange = (m: ModelId) => { setModel(m); localStorage.setItem(MODEL_KEY, m) }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setScanError(null)
    setScanning(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = ev => resolve(ev.target?.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const [header, base64] = dataUrl.split(',')
      const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      const result = await parseWithClaude(base64, mimeType, note, model)
      result.vendor = VENDORS.includes(result.vendor) ? result.vendor : 'Інше'
      result.date = result.date || new Date().toISOString().slice(0, 10)
      setPreview(result)
      setPreviewItems(result.items)
      setNote('')
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to parse receipt')
    } finally {
      setScanning(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview || previewItems.length === 0) return
    setSaving(true)
    try {
      // Aggregate individual items → category totals for storage
      const categoryMap = previewItems.reduce<Record<string, number>>((acc, item) => {
        acc[item.category] = (acc[item.category] ?? 0) + item.total
        return acc
      }, {})
      await supabase.from('receipt_items').insert(
        Object.entries(categoryMap).map(([category, total]) => ({
          profile_id: profileId,
          category,
          vendor: preview.vendor,
          date: preview.date,
          total_amount: Math.round(total * 100) / 100,
        }))
      )
      setPreview(null)
      setPreviewItems([])
      load()
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  const handleManualSave = async (vendor: string, date: string, entries: ManualEntry[]) => {
    const rows = entries
      .map(e => ({ category: e.category, amount: parseFloat(e.amount) }))
      .filter(r => r.amount > 0)
    if (rows.length === 0) return
    setManualSaving(true)
    try {
      await supabase.from('receipt_items').insert(
        rows.map(r => ({
          profile_id: profileId,
          category: r.category,
          vendor,
          date,
          total_amount: Math.round(r.amount * 100) / 100,
        }))
      )
      setShowManualModal(false)
      load()
      onSaved?.()
    } finally {
      setManualSaving(false)
    }
  }

  const handleEditSave = async (vendor: string, date: string, entries: ManualEntry[]) => {
    if (!editingGroup) return
    const group = groupMap[editingGroup]
    const rows = entries
      .map(e => ({ category: e.category, amount: parseFloat(e.amount) }))
      .filter(r => r.amount > 0)
    if (rows.length === 0) return
    setManualSaving(true)
    try {
      await supabase.from('receipt_items').delete().in('id', group.items.map(i => i.id))
      await supabase.from('receipt_items').insert(
        rows.map(r => ({
          profile_id: profileId,
          category: r.category,
          vendor,
          date,
          total_amount: Math.round(r.amount * 100) / 100,
        }))
      )
      setEditingGroup(null)
      load()
      onSaved?.()
    } finally {
      setManualSaving(false)
    }
  }

  const handleGroupDelete = async () => {
    if (!editingGroup) return
    const group = groupMap[editingGroup]
    setManualSaving(true)
    try {
      await supabase.from('receipt_items').delete().in('id', group.items.map(i => i.id))
      setEditingGroup(null)
      load()
      onSaved?.()
    } finally {
      setManualSaving(false)
    }
  }

  const handleDeleteItem = async (id: string) => {
    await supabase.from('receipt_items').delete().eq('id', id)
    load()
    onSaved?.()
  }

  // Group saved items by date + vendor for the list view
  const groupMap = items.reduce<Record<string, ReceiptGroup>>((acc, item) => {
    const key = `${item.date}|${item.vendor ?? 'Інше'}`
    if (!acc[key]) acc[key] = { key, date: item.date, vendor: item.vendor ?? 'Інше', items: [], total: 0 }
    acc[key].items.push(item)
    acc[key].total += item.total_amount
    return acc
  }, {})
  const groups = Object.values(groupMap).sort((a, b) => b.date.localeCompare(a.date))

  const toggleGroup = (key: string) =>
    setExpandedGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  // Group preview items by category for display
  const previewGrouped = previewItems.reduce<Record<string, { item: ParsedItem; idx: number }[]>>((acc, item, idx) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push({ item, idx })
    return acc
  }, {})
  const previewCategories = Object.entries(previewGrouped)
    .sort(([a], [b]) => a.localeCompare(b))
  const previewTotal = previewItems.reduce((s, i) => s + i.total, 0)

  return (
    <>
      <Widget title="Receipts" icon={<Camera size={14} />} dragHandle={dragHandle}
        action={
          <div className="flex items-center gap-1">
            <button onClick={() => setShowManualModal(true)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
              title="Add expense manually">
              <Plus size={14} />
            </button>
            <button onClick={() => { setScanError(null); setShowScanModal(true) }} disabled={scanning}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
              title="Scan receipt">
              {scanning ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
          </div>
        }
      >
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileChange} className="hidden" />

        {scanError && <div className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 mb-2">{scanError}</div>}
        {scanning && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center">
            <Loader2 size={16} className="animate-spin" />
            Parsing with {MODELS.find(m => m.id === model)?.label ?? model}…
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {groups.map(group => {
            const isExpanded = expandedGroups.has(group.key)
            const dateStr = new Date(group.date + 'T12:00:00').toLocaleDateString('uk', { day: 'numeric', month: 'short' })
            return (
              <div key={group.key} className="rounded-xl overflow-hidden border border-border/60">
                <div
                  className="flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => toggleGroup(group.key)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-white font-medium">{group.vendor}</span>
                    <span className="text-xs text-gray-500">{dateStr}</span>
                    <span className="text-xs text-gray-600">{group.items.length} кат.</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); setEditingGroup(group.key) }}
                      className="p-0.5 text-gray-600 hover:text-gray-300 transition-colors"
                      title="Edit receipt"
                    >
                      <Pencil size={11} />
                    </button>
                    <span className="text-sm text-white font-semibold">₴{group.total.toFixed(0)}</span>
                    {isExpanded ? <ChevronUp size={13} className="text-gray-500" /> : <ChevronDown size={13} className="text-gray-500" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-2 flex flex-col gap-0.5 border-t border-border/60">
                    {group.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between py-1 group/row">
                        <span className="text-xs text-gray-300">{item.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white">₴{item.total_amount.toFixed(2)}</span>
                          <button onClick={() => handleDeleteItem(item.id)}
                            className="opacity-0 group-hover/row:opacity-100 text-gray-400 hover:text-red-400 transition-all">
                            <X size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {groups.length === 0 && !scanning && (
            <p className="text-gray-500 text-sm text-center py-4">No receipts in last 30 days</p>
          )}
        </div>
      </Widget>

      {showManualModal && (
        <ManualEntryModal
          onSave={handleManualSave}
          onClose={() => setShowManualModal(false)}
          saving={manualSaving}
        />
      )}

      {editingGroup && groupMap[editingGroup] && (() => {
        const g = groupMap[editingGroup]
        return (
          <ManualEntryModal
            initialVendor={g.vendor}
            initialDate={g.date}
            initialEntries={g.items.map((item, i) => ({
              id: i,
              category: item.category,
              amount: String(item.total_amount),
            }))}
            onSave={handleEditSave}
            onDelete={handleGroupDelete}
            onClose={() => setEditingGroup(null)}
            saving={manualSaving}
          />
        )
      })()}

      {showScanModal && (
        <ScanModal model={model} setModel={handleModelChange} note={note} setNote={setNote}
          onScan={() => { setShowScanModal(false); fileInputRef.current?.click() }}
          onClose={() => setShowScanModal(false)} />
      )}

      {preview && (
        <Modal title={`${preview.vendor} · ${preview.date}`} onClose={() => { setPreview(null); setPreviewItems([]) }}>
          <div className="flex flex-col gap-3">
            {/* Vendor + date */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Vendor</label>
                <select value={preview.vendor} onChange={e => setPreview(p => p ? { ...p, vendor: e.target.value } : p)}
                  className="bg-white/5 border border-border rounded-xl px-2 py-1.5 text-white text-sm focus:outline-none">
                  {VENDORS.map(v => <option key={v} value={v} className="bg-card">{v}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Date</label>
                <input type="date" value={preview.date} onChange={e => setPreview(p => p ? { ...p, date: e.target.value } : p)}
                  className="bg-white/5 border border-border rounded-xl px-2 py-1.5 text-white text-sm focus:outline-none" />
              </div>
            </div>

            {/* Items grouped by category */}
            <div className="max-h-80 overflow-y-auto scrollbar-none flex flex-col gap-2">
              {previewCategories.map(([category, entries]) => {
                const catTotal = entries.reduce((s, e) => s + e.item.total, 0)
                return (
                  <div key={category}>
                    {/* Category header */}
                    <div className="flex items-center justify-between px-0.5 pb-1 border-b border-border">
                      <span className="text-xs font-semibold text-gray-300">{category}</span>
                      <span className="text-xs text-gray-400">₴{catTotal.toFixed(2)}</span>
                    </div>
                    {/* Items in this category */}
                    {entries.map(({ item, idx }) => (
                      <PreviewItemRow
                        key={idx}
                        item={item}
                        onChange={updated => setPreviewItems(prev => prev.map((it, i) => i === idx ? updated : it))}
                        onRemove={() => setPreviewItems(prev => prev.filter((_, i) => i !== idx))}
                      />
                    ))}
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <span className="text-sm text-gray-400">{previewItems.length} items · {previewCategories.length} categories</span>
              <span className="text-sm font-bold text-white">₴{previewTotal.toFixed(2)}</span>
            </div>
            <button onClick={handleConfirm} disabled={previewItems.length === 0 || saving}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              {saving ? 'Saving…' : `Save ${previewCategories.length} categories`}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
