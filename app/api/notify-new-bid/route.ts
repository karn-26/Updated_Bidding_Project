import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { orderId, supplierName } = await request.json();
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    const admin = createAdminClient();

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("restaurant_id, title")
      .eq("id", orderId)
      .single();

    if (orderError || !order) throw orderError ?? new Error("Order not found");

    const { error } = await admin.from("notifications").insert({
      user_id: order.restaurant_id,
      title: "New Bid Received",
      message: `${supplierName} submitted a bid on your order "${order.title}".`,
      is_read: false,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notify-new-bid] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
