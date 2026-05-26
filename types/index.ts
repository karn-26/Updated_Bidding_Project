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

export interface Bid {
  id: string;
  order_id: string;
  supplier_id: string;
  supplier_name: string;
  price: number;
  notes: string;
  status: "pending" | "won" | "rejected";
  created_at: string;
  supplier_profile?: SupplierProfile;
}

export interface SupplierProfile {
  id: string;
  business_name: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  average_rating: number;
  total_ratings: number;
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
  city: string | null;
  country: string | null;
  phone: string | null;
  vehicle_type: "bike" | "car" | "van" | "truck" | null;
  is_available: boolean;
  average_rating: number;
  total_ratings: number;
  updated_at: string;
}

export interface Delivery {
  id: string;
  order_id: string;
  bid_id: string;
  delivery_partner_id: string | null;
  restaurant_id: string;
  supplier_id: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  delivery_method: "supplier" | "delivery_partner";
  status: "pending" | "claimed" | "picked_up" | "delivered";
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
