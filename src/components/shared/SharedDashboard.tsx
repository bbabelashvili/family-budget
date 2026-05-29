import { useState, useEffect, useCallback } from 'react'
import { LogOut, Receipt, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Widget } from '../ui/Widget'
import { IncomeWidget } from '../dashboard/IncomeWidget'
import { SavingsWidget } from '../dashboard/SavingsWidget'
import { ReceiptScanner } from './ReceiptScanner'
import { formatCurrency, formatUAH, toUAH, currentMonth } from '../../lib/utils'
import type { Receipt as ReceiptType, Currency } from '../../types'

interface Props { onLogout: () => void }

export function SharedDashboard({ onLogout }: Props) {
  const [receipts, setReceipts] = useState<ReceiptType[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const month = currentMonth()

  const loadCurrencies = useCallback(async () => {
    const { data } = await supabase.from('currencies').select('*').order('code')
    if (data) setCurrencies(data)
  }, [])

  const loadReceipts = useCallback(async () => {
    const startDate = month
    const endDate = new Date(new Date(month).setMonth(new Date(month).getMonth() + 1)).toISOString().slice(0, 10)
    const { data: r } = await supabase
      .from('receipts')
      .select('*, currency:currencies(*)')
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date', { ascending: false })
    if (r) setReceipts(r as ReceiptType[])
  }, [month])

  useEffect(() => { loadCurrencies() }, [loadCurrencies])
  useEffect(() => { loadReceipts() }, [loadReceipts])

  const handleDeleteReceipt = async (id: string) => {
    await supabase.from('receipts').delete().eq('id', id)
    loadReceipts()
  }

  const totalUAH = receipts.reduce((sum, r) => {
    const rate = (r.currency as Currency | undefined)?.exchange_rate ?? 1
    return sum + toUAH(r.total, rate)
  }, 0)

  return (
    <div className="min-h-dvh pb-10">
      <header className="sticky top-0 z-10 bg-surface/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-emerald-400">Shared</span>
        <button
          onClick={onLogout}
          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <LogOut size={16} />
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Shared income + savings */}
        <IncomeWidget profileId="shared" month={month} currencies={currencies} />
        <SavingsWidget profileId="shared" currencies={currencies} />

        {/* Receipt scanner */}
        <div className="md:col-span-2">
          <Widget title="Receipt Scanner" icon={<Receipt size={14} />}>
            <ReceiptScanner currencies={currencies} onSaved={loadReceipts} />
          </Widget>
        </div>

        {/* Recent receipts */}
        <div className="md:col-span-2">
          <Widget
            title="This Month's Receipts"
            icon={<Receipt size={14} />}
            action={receipts.length > 0 ? (
              <span className="text-sm text-gray-400 font-medium">{formatUAH(totalUAH)}</span>
            ) : undefined}
          >
            {receipts.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">No receipts yet — scan one above</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {receipts.map(r => {
                  const code = (r.currency as Currency | undefined)?.code ?? 'UAH'
                  const rate = (r.currency as Currency | undefined)?.exchange_rate ?? 1
                  return (
                    <div key={r.id} className="flex items-center justify-between py-3 group">
                      <div>
                        <div className="text-sm text-white">{r.merchant ?? 'Unknown merchant'}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{r.date} · {r.category}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm text-white font-medium">{formatCurrency(r.total, code)}</div>
                          {code !== 'UAH' && (
                            <div className="text-xs text-gray-500">{formatUAH(toUAH(r.total, rate))}</div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteReceipt(r.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Widget>
        </div>
      </main>
    </div>
  )
}
