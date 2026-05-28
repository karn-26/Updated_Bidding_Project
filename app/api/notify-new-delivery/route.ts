import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { deliveryId, orderTitle, deliveryFee } = await request.json();
    if (!deliveryId) return NextResponse.json({ error: "Missing deliveryId" }, { status: 400 });

    const admin = createAdminClient();

    const { data: { users }, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;

    const partners = users.filter((u) => u.user_metadata?.role === "delivery_partner");
    if (partners.length === 0) return NextResponse.json({ ok: true, notified: 0 });

    const feeText = deliveryFee ? ` · ¥${Number(deliveryFee).toLocaleString()} fee` : "";

    const notifications = partners.map((p) => ({
      user_id: p.id,
      title:   "New Delivery Available",
      message: `A delivery for "${orderTitle}"${feeText} is ready to be claimed. Be the first!`,
      is_read: false,
      link:    `/delivery/dashboard`,
    }));

    const { error } = await admin.from("notifications").insert(notifications);
    if (error) throw error;

    return NextResponse.json({ ok: true, notified: partners.length });
  } catch (err) {
    console.error("[notify-new-delivery] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
