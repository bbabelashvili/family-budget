export function formatUAH(amount: number): string {
  return `₴${Math.round(amount).toLocaleString('uk-UA')}`
}

export function formatCurrency(amount: number, code: string): string {
  const symbols: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' }
  const symbol = symbols[code] ?? code + ' '
  const decimals = code === 'UAH' ? 0 : 2
  return `${symbol}${amount.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

export function toUAH(amount: number, rate: number): number {
  return amount * rate
}

export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export function formatMonth(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en', { month: 'long', year: 'numeric' })
}

export function prevMonth(dateStr: string): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function nextMonth(dateStr: string): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function isCurrentMonth(dateStr: string): boolean {
  return dateStr === currentMonth()
}
