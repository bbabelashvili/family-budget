import { useState, useRef } from 'react'
import { Camera, Upload, Check, X, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Currency, ReceiptItem } from '../../types'

interface ParsedReceipt {
  merchant: string
  date: string
  total: number
  currency: string
  items: ReceiptItem[]
  category: string
}

interface Props {
  currencies: Currency[]
  onSaved: () => void
}

export function ReceiptScanner({ currencies, onSaved }: Props) {
  const [, setImageBase64] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null)
  const [form, setForm] = useState<ParsedReceipt | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      setImagePreview(dataUrl)
      const base64 = dataUrl.split(',')[1]
      setImageBase64(base64)
      parseReceipt(base64, file.type)
    }
    reader.readAsDataURL(file)
  }

  const parseReceipt = async (base64: string, mimeType: string) => {
    setError('')
    setParsing(true)
    setParsed(null)
    setForm(null)

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
    if (!apiKey) {
      setError('VITE_ANTHROPIC_API_KEY not set in .env file')
      setParsing(false)
      return
    }

    try {
      const validMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType) ? mimeType : 'image/jpeg'
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-request-mode': 'cors',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: validMime, data: base64 },
              },
              {
                type: 'text',
                text: 'Parse this receipt. Return ONLY a JSON object (no markdown, no explanation) with these exact fields: merchant (string or null), date (YYYY-MM-DD string, use today if unclear), total (number), currency (3-letter ISO code, default UAH), items (array of {name: string, price: number, quantity: number}), category (one of: groceries, restaurant, pharmacy, transport, clothing, electronics, household, entertainment, other).',
              },
            ],
          }],
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: { message?: string } }).error?.message ?? `API error ${res.status}`)
      }

      const data = await res.json() as { content: [{ text: string }] }
      const text = data.content[0].text.trim()
      const result = JSON.parse(text) as ParsedReceipt
      result.date = result.date || new Date().toISOString().slice(0, 10)
      setParsed(result)
      setForm(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse receipt')
    } finally {
      setParsing(false)
    }
  }

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    const cur = currencies.find(c => c.code === form.currency) ?? currencies.find(c => c.code === 'UAH')
    await supabase.from('receipts').insert({
      merchant: form.merchant || null,
      total: form.total,
      currency_id: cur?.id ?? 1,
      date: form.date,
      items: form.items,
      category: form.category,
    })
    setSaving(false)
    setImageBase64(null)
    setImagePreview(null)
    setParsed(null)
    setForm(null)
    onSaved()
  }

  const reset = () => {
    setImageBase64(null)
    setImagePreview(null)
    setParsed(null)
    setForm(null)
    setError('')
    setParsing(false)
  }

  if (!imagePreview) {
    return (
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-border hover:border-gray-500 rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors group"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
        />
        <div className="w-14 h-14 rounded-2xl bg-white/5 group-hover:bg-white/10 flex items-center justify-center transition-colors">
          <Camera size={24} className="text-gray-400" />
        </div>
        <div className="text-center">
          <p className="text-white font-medium text-sm">Scan a receipt</p>
          <p className="text-gray-500 text-xs mt-0.5">Take a photo or upload an image</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Camera size={12} /> <span>Camera</span>
          <span className="mx-1">·</span>
          <Upload size={12} /> <span>Gallery</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Image preview + actions */}
      <div className="relative">
        <img src={imagePreview} alt="Receipt" className="w-full max-h-48 object-contain rounded-xl border border-border" />
        <button
          onClick={reset}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {parsing && (
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 size={14} className="animate-spin" />
          <span>Parsing receipt…</span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {form && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Merchant</label>
              <input
                type="text"
                value={form.merchant ?? ''}
                onChange={e => setForm(f => f ? { ...f, merchant: e.target.value } : f)}
                className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => f ? { ...f, date: e.target.value } : f)}
                className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Total</label>
              <input
                type="number"
                value={form.total}
                onChange={e => setForm(f => f ? { ...f, total: parseFloat(e.target.value) } : f)}
                className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Currency</label>
              <select
                value={form.currency}
                onChange={e => setForm(f => f ? { ...f, currency: e.target.value } : f)}
                className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
              >
                {currencies.map(c => <option key={c.id} value={c.code} className="bg-card">{c.code}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Category</label>
            <input
              type="text"
              value={form.category}
              onChange={e => setForm(f => f ? { ...f, category: e.target.value } : f)}
              className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
            />
          </div>

          {parsed && form.items?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Items ({form.items.length})</p>
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto scrollbar-none">
                {form.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                    <span className="text-gray-300">{item.name}</span>
                    <span className="text-gray-400">{item.quantity > 1 ? `${item.quantity} × ` : ''}{item.price}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Saving…' : 'Save Receipt'}
          </button>
        </div>
      )}
    </div>
  )
}
