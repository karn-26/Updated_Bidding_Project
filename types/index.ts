export type UserRole = "restaurant_owner" | "supplier" | "delivery_partner";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  business_name: string;
  created_at: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  title: string;
  description: string;
  items: OrderItem[];
  status: "open" | "closed" | "cancelled" | "in_delivery" | "fulfilled";
  deadline: string;
  created_at: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  unit: string;
}

/**
 * delivery_type:
 *   'supplier' — supplier self-delivers; delivery_fee was manually entered
 *                (AI estimate shown as reference only)
 *   'partner'  — platform finds a delivery partner; delivery_fee is AI-fixed
 */
export interface Bid {
  id: string;
  order_id: string;
  supplier_id: string;
  supplier_name: string;
  price: number;
  /** Total price the restaurant pays = price + delivery_fee */
  delivery_type: "supplier" | "partner";
  delivery_fee: number;
  delivery_fee_estimated: boolean;
  notes: string;
  status: "pending" | "won" | "rejected";
  created_at: string;
  supplier_profile?: SupplierProfile;
}

/** Japanese structured address — all four fields required at signup */
export interface JapanAddress {
  postal_code: string;  // NNN-NNNN format
  prefecture: string;   // 都道府県
  city_ward: string;    // 市区町村
  block_banchi: string; // 丁目・番地
}

export interface SupplierProfile {
  id: string;
  business_name: string | null;
  // Structured Japan address (new; supersedes old city/country)
  postal_code: string | null;
  prefecture: string | null;
  city_ward: string | null;
  block_banchi: string | null;
  latitude: number | null;
  longitude: number | null;
  // Legacy fields kept for backward compat; not written by new code
  city: string | null;
  country: string | null;
  average_rating: number;
  total_ratings: number;
  updated_at: string;
}

export interface RestaurantProfile {
  id: string;
  business_name: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city_ward: string | null;
  block_banchi: string | null;
  latitude: number | null;
  longitude: number | null;
  updated_at: string;
}

export interface SupplierRating {
  id: string;
  supplier_id: string;
  restaurant_id: string;
  order_id: string;
  restaurant_business_name: string | null;
  rating: number;
  review: string | null;
  created_at: string;
}

export interface DeliveryPartner {
  id: string;
  business_name: string;
  // Structured Japan address (new; supersedes old city/country)
  postal_code: string | null;
  prefecture: string | null;
  city_ward: string | null;
  block_banchi: string | null;
  latitude: number | null;
  longitude: number | null;
  // Legacy fields kept for backward compat
  city: string | null;
  country: string | null;
  phone: string | null;
  vehicle_type: "bike" | "car" | "van" | "truck" | null;
  is_available: boolean;
  average_rating: number;
  total_ratings: number;
  updated_at: string;
}

/**
 * delivery_method on the deliveries row mirrors bid.delivery_type:
 *   'supplier'         — supplier is the deliverer
 *                        (delivery_partner_id = supplier_id; status starts at 'claimed')
 *   'delivery_partner' — partner claims the job from the marketplace
 *                        (status starts at 'pending')
 *
 * Status flow:
 *   supplier:  claimed → picked_up → delivered
 *   partner:   pending → claimed → picked_up → delivered
 *
 * Fallback (partner job not claimed before partner_deadline):
 *   Supplier is shown options: self-deliver or cancel.
 */
export interface Delivery {
  id: string;
  order_id: string;
  bid_id: string;
  delivery_partner_id: string | null;
  restaurant_id: string;
  supplier_id: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  /** Mirrors bid.delivery_type mapped to 'supplier' | 'delivery_partner' */
  delivery_method: "supplier" | "delivery_partner";
  delivery_fee: number;
  status: "pending" | "claimed" | "picked_up" | "delivered";
  partner_deadline: string | null;
  claimed_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface DeliveryRating {
  id: string;
  delivery_id: string;
  delivery_partner_id: string;
  rated_by: string;
  rating: number;
  review: string | null;
  created_at: string;
}
