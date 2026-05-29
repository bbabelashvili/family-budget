import { useState, type ReactNode } from 'react'
import { RefreshCw, Check, Pencil, Plus, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { Modal } from '../ui/Modal'
import type { Currency } from '../../types'

interface Props {
  currencies: Currency[]
  onUpdate: () => void
  dragHandle?: ReactNode
}

const EMPTY_ADD_FORM = { code: '', name: '', exchange_rate: '' }

export function CurrencyWidget({ currencies, onUpdate, dragHandle }: Props) {
  const [editing, setEditing] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const startEdit = (c: Currency) => {
    setEditing(c.id)
    setEditValue(String(c.exchange_rate))
  }

  const saveEdit = async (id: number) => {
    const rate = parseFloat(editValue)
    if (isNaN(rate) || rate <= 0) return
    await supabase
      .from('currencies')
      .update({ exchange_rate: rate, updated_at: new Date().toISOString() })
      .eq('id', id)
    setEditing(null)
    onUpdate()
  }

  const handleDelete = async (id: number) => {
    setDeleteError(null)
    const { error } = await supabase.from('currencies').delete().eq('id', id)
    if (error) {
      setDeleteError('In use — remove this currency from all records first')
      return
    }
    onUpdate()
  }

  const handleAdd = async () => {
    const code = addForm.code.trim().toUpperCase()
    const name = addForm.name.trim()
    const rate = parseFloat(addForm.exchange_rate)
    if (!code || !name || isNaN(rate) || rate <= 0) return
    await supabase.from('currencies').insert({ code, name, exchange_rate: rate, updated_at: new Date().toISOString() })
    setAddForm(EMPTY_ADD_FORM)
    setShowAddModal(false)
    onUpdate()
  }

  const visible = currencies.filter(c => c.code !== 'UAH')
  const lastUpdated = visible[0]?.updated_at
    ? new Date(visible[0].updated_at).toLocaleDateString('en', { day: 'numeric', month: 'short' })
    : null

  return (
    <>
      <Widget
        title="Exchange Rates"
        icon={<RefreshCw size={14} />}
        action={
          <div className="flex items-center gap-2">
            {lastUpdated && <span className="text-xs text-gray-400">Updated {lastUpdated}</span>}
            <button onClick={() => setShowAddModal(true)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors">
              <Plus size={14} />
            </button>
          </div>
        }
        dragHandle={dragHandle}
      >
        <div className="flex flex-col gap-2">
          {deleteError && (
            <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{deleteError}</p>
          )}
          {visible.map(c => (
            <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <span className="text-white font-medium text-sm">{c.code}</span>
                <span className="text-gray-400 text-xs ml-2">{c.name}</span>
              </div>

              {editing === c.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void saveEdit(c.id); if (e.key === 'Escape') setEditing(null) }}
                    className="w-20 bg-white/10 text-white text-sm text-right rounded-lg px-2 py-1 border border-white/20 focus:outline-none focus:border-white/40"
                    autoFocus
                  />
                  <span className="text-gray-400 text-xs">₴</span>
                  <button onClick={() => void saveEdit(c.id)} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                    <Check size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono text-sm">₴{c.exchange_rate}</span>
                  <button onClick={() => startEdit(c)} className="text-gray-600 hover:text-gray-300 transition-colors">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="text-gray-700 hover:text-red-400 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {visible.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">No currencies</p>
          )}
        </div>
      </Widget>

      {showAddModal && (
        <Modal title="Add Currency" onClose={() => { setShowAddModal(false); setAddForm(EMPTY_ADD_FORM) }}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Code</label>
                <input type="text" placeholder="e.g. GBP" value={addForm.code} maxLength={5}
                  onChange={e => setAddForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Name</label>
                <input type="text" placeholder="e.g. British Pound" value={addForm.name}
                  onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                  className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-400">Rate to UAH (₴)</label>
              <input type="number" placeholder="0" value={addForm.exchange_rate}
                onChange={e => setAddForm(p => ({ ...p, exchange_rate: e.target.value }))}
                className="bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
            </div>
            <button onClick={handleAdd} disabled={!addForm.code || !addForm.name || !addForm.exchange_rate}
              className="bg-white text-black font-semibold rounded-xl py-2.5 text-sm hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-1">
              Add Currency
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
