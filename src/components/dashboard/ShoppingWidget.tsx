import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { ShoppingCart, Plus } from 'lucide-react'
import { DeleteButton } from '../ui/DeleteButton'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import type { TravelShoppingItem, ProfileId } from '../../types'

interface Props {
  profileId: ProfileId
  dragHandle?: ReactNode
}

export function ShoppingWidget({ profileId, dragHandle }: Props) {
  const [items, setItems] = useState<TravelShoppingItem[]>([])
  const [showInput, setShowInput] = useState(false)
  const [newItem, setNewItem] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('travel_shopping').select('*')
      .eq('profile_id', profileId).order('checked').order('sort_order').order('created_at')
    if (data) setItems(data as TravelShoppingItem[])
  }, [profileId])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    const name = newItem.trim()
    if (!name) return
    const maxOrder = items.reduce((m, i) => Math.max(m, i.sort_order), 0)
    await supabase.from('travel_shopping').insert({ profile_id: profileId, name, sort_order: maxOrder + 1 })
    setNewItem(''); load()
  }

  const handleToggle = async (item: TravelShoppingItem) => {
    await supabase.from('travel_shopping').update({ checked: !item.checked }).eq('id', item.id)
    load()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('travel_shopping').delete().eq('id', id); load()
  }

  const clearChecked = async () => {
    const checkedIds = items.filter(i => i.checked).map(i => i.id)
    if (!checkedIds.length) return
    await supabase.from('travel_shopping').delete().in('id', checkedIds); load()
  }

  const unchecked = items.filter(i => !i.checked)
  const checked = items.filter(i => i.checked)

  return (
    <Widget title="What to Buy" icon={<ShoppingCart size={14} />} dragHandle={dragHandle}
      action={
        <div className="flex items-center gap-1">
          {checked.length > 0 && (
            <button onClick={clearChecked} className="px-2 py-1 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-white/5 transition-colors">
              Clear {checked.length}
            </button>
          )}
          <button onClick={() => setShowInput(v => !v)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors">
            <Plus size={14} />
          </button>
        </div>
      }>
      <div className="flex flex-col gap-1">
        {showInput && (
          <div className="flex gap-2 mb-2">
            <input
              type="text" placeholder="Item name" value={newItem} autoFocus
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleAdd(); if (e.key === 'Escape') { setShowInput(false); setNewItem('') } }}
              className="flex-1 bg-white/5 border border-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
            />
            <button onClick={handleAdd} disabled={!newItem.trim()}
              className="px-3 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-30">
              Add
            </button>
          </div>
        )}

        {unchecked.map(item => (
          <div key={item.id} className="flex items-center gap-2.5 py-1.5 group">
            <button onClick={() => handleToggle(item)}
              className="w-4 h-4 rounded border border-gray-600 hover:border-white flex-shrink-0 transition-colors" />
            <span className="text-sm text-gray-300 flex-1">{item.name}</span>
            <DeleteButton onDelete={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all" />
          </div>
        ))}

        {checked.length > 0 && (
          <>
            {unchecked.length > 0 && <div className="border-t border-border my-1" />}
            {checked.map(item => (
              <div key={item.id} className="flex items-center gap-2.5 py-1.5 group">
                <button onClick={() => handleToggle(item)}
                  className="w-4 h-4 rounded border border-emerald-500 bg-emerald-500/30 flex-shrink-0 flex items-center justify-center transition-colors">
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <span className="text-sm text-gray-600 line-through flex-1">{item.name}</span>
                <DeleteButton onDelete={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all" />
              </div>
            ))}
          </>
        )}

        {items.length === 0 && !showInput && (
          <p className="text-gray-500 text-sm text-center py-4">Nothing to buy yet</p>
        )}

        {items.length > 0 && (
          <div className="mt-2 text-xs text-gray-600 text-right">
            {checked.length}/{items.length} done
          </div>
        )}
      </div>
    </Widget>
  )
}
