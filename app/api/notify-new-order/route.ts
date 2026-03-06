import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { orderId, orderTitle } = await request.json();
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    const admin = createAdminClient();

    const { data: { users }, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;

    const suppliers = users.filter((u) => u.user_metadata?.role === "supplier");
    if (suppliers.length === 0) return NextResponse.json({ ok: true, notified: 0 });

    const notifications = suppliers.map((s) => ({
      user_id: s.id,
      title: "New Order Available",
      message: `A new order "${orderTitle}" has been posted. Be the first to bid!`,
      is_read: false,
    }));

    const { error } = await admin.from("notifications").insert(notifications);
    if (error) throw error;

    return NextResponse.json({ ok: true, notified: suppliers.length });
  } catch (err) {
    console.error("[notify-new-order] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
