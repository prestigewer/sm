export type Role = 'customer' | 'admin'
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'partial' | 'failed' | 'cancelled' | 'refunded'
export const ORDER_STATUSES: OrderStatus[] = ['pending', 'processing', 'completed', 'partial', 'failed', 'cancelled', 'refunded']

export interface Profile {
  id: string; full_name: string; email: string; phone: string | null
  role: Role; status: 'active' | 'suspended'; created_at: string
}
export interface PublicService {
  id: string; category_id: string; platform: string; category_name: string; name: string
  description: string; customer_rate: number; min_qty: number; max_qty: number
  est_time: string; refill_policy: string; cancel_policy: string; is_active: boolean
}
export interface Order {
  id: string; order_no: number; user_id: string; service_id: string; service_name: string
  target_url: string; quantity: number; customer_price: number; refunded_amount: number
  status: OrderStatus; cancel_requested: boolean; created_at: string; updated_at: string
}
export interface WalletTx {
  id: string; user_id: string; type: string; amount: number; balance_before: number
  balance_after: number; order_id: string | null; recharge_id: string | null
  description: string; created_at: string
}
export interface Recharge {
  id: string; user_id: string; amount: number; transaction_ref: string; proof_path: string | null
  status: 'pending' | 'approved' | 'rejected'; public_note: string | null; created_at: string
}
export interface SiteSettings {
  brand_name: string; logo_url: string | null; currency_code: string; currency_symbol: string
  credits_per_currency_unit: number; primary_color: string
}
export interface PaymentSetting {
  id: string; method_name: string; account_holder: string; account_details: string
  instructions: string; supported_currencies: string[]; min_recharge: number; is_enabled: boolean
}
