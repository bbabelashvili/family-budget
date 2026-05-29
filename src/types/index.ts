export type ProfileId = 'mine' | 'hers' | 'shared' | 'travels'

export interface Profile {
  id: ProfileId
  name: string
  pin_hash: string | null
}

export interface Currency {
  id: number
  code: string
  name: string
  exchange_rate: number
  updated_at: string
}

export interface Income {
  id: string
  profile_id: ProfileId
  source: string
  total: number
  currency_id: number
  brutto: number | null
  net: number | null
  tax_rate: number
  month: string
  created_at: string
  currency?: Currency
}

export interface Savings {
  id: string
  profile_id: ProfileId
  type: string
  uah_amount: number
  usd_amount: number
  eur_amount: number
  updated_at: string
}

export interface Subscription {
  id: string
  profile_id: ProfileId
  name: string
  price: number
  currency_id: number
  billing_cycle: 'monthly' | 'annual'
  next_billing_date: string | null
  active: boolean
  created_at: string
  currency?: Currency
}

export interface RegularExpense {
  id: string
  profile_id: ProfileId
  name: string
  amount: number
  currency_id: number
  category: 'family' | 'utilities' | 'car' | 'debt' | 'other'
  frequency: 'monthly' | 'annual'
  active: boolean
  created_at: string
  currency?: Currency
}

export interface UnplannedExpense {
  id: string
  profile_id: ProfileId
  description: string
  amount: number
  currency_id: number
  category: string | null
  date: string
  created_at: string
  currency?: Currency
}

export interface Goal {
  id: string
  profile_id: ProfileId
  name: string
  type: 'savings' | 'purchase'
  target_amount: number
  current_amount: number
  currency_id: number
  deadline: string | null
  created_at: string
  currency?: Currency
}

export interface Debt {
  id: string
  profile_id: ProfileId
  name: string
  total_amount: number
  payment_amount: number
  payments_total: number
  payments_left: number
  currency_id: number
  billing_cycle: 'monthly' | 'biweekly' | 'weekly'
  due_date: string
  active: boolean
  created_at: string
}

export interface TravelConfig {
  id: string
  profile_id: ProfileId
  trip_name: string | null
  budget_amount: number
  currency_id: number | null
  start_date: string | null
  end_date: string | null
  updated_at: string
}

export interface TravelAccommodation {
  id: string
  profile_id: ProfileId
  name: string
  check_in: string | null
  check_out: string | null
  amount: number
  currency_id: number
  notes: string | null
  created_at: string
}

export type TransportType = 'flight' | 'train' | 'car' | 'bus' | 'ferry' | 'other'

export interface TravelTransport {
  id: string
  profile_id: ProfileId
  type: TransportType
  description: string
  from_location: string | null
  to_location: string | null
  date: string | null
  amount: number
  currency_id: number
  notes: string | null
  created_at: string
}

export interface TravelExpense {
  id: string
  profile_id: ProfileId
  description: string
  category: string
  date: string
  amount: number
  currency_id: number
  created_at: string
}

export interface TravelShoppingItem {
  id: string
  profile_id: ProfileId
  name: string
  checked: boolean
  sort_order: number
  created_at: string
}

export interface ReceiptItem {
  name: string
  price: number
  quantity: number
  category?: string
}

export interface Receipt {
  id: string
  merchant: string | null
  total: number
  currency_id: number
  date: string
  items: ReceiptItem[] | null
  category: string | null
  image_path: string | null
  created_at: string
  currency?: Currency
}

export interface GroceryItem {
  id: string
  profile_id: ProfileId
  category: string
  vendor: string | null
  date: string
  total_amount: number
  created_at: string
}

export interface FamilyConfig {
  id: string
  profile_id: ProfileId
  monthly_budget: number
  currency_id: number
  updated_at: string
}
