export type UserRole = "restaurant_owner" | "supplier";

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
  status: "open" | "fulfilled" | "cancelled";
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
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}
