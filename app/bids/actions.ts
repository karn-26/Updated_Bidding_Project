"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function acceptBid(formData: FormData) {
  const bidId   = formData.get("bid_id")   as string | null;
  const orderId = formData.get("order_id") as string | null;

  console.log("[acceptBid] called with bidId:", bidId, "orderId:", orderId);

  if (!bidId || !orderId) {
    console.error("[acceptBid] Missing bidId or orderId — aborting.");
    return;
  }

  const supabase = createClient();

  // Verify the session is active
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log("[acceptBid] auth user:", user?.id ?? null, "authError:", authError);
  if (!user) {
    console.error("[acceptBid] No authenticated user — aborting.");
    return;
  }

  // 0. Fetch the winning bid to get supplier_id and order title
  const { data: winningBid } = await supabase
    .from("bids")
    .select("id, supplier_id")
    .eq("id", bidId)
    .single();

  // 1. Mark the winning bid as 'won'
  const { data: wonData, error: winError } = await supabase
    .from("bids")
    .update({ status: "won" })
    .eq("id", bidId)
    .select("id, status");

  console.log("[acceptBid] set winning bid result — data:", wonData, "error:", winError);

  if (winError) {
    console.error("[acceptBid] Failed to set winning bid:", winError);
    return;
  }
  if (!wonData || wonData.length === 0) {
    console.error("[acceptBid] Winning bid update matched 0 rows. Check RLS or bidId.");
    return;
  }

  // 2. Reject every other bid on the same order
  const { data: rejectedData, error: rejectError } = await supabase
    .from("bids")
    .update({ status: "rejected" })
    .eq("order_id", orderId)
    .neq("id", bidId)
    .select("id, supplier_id");

  console.log("[acceptBid] reject other bids result — data:", rejectedData, "error:", rejectError);

  if (rejectError) console.error("[acceptBid] Failed to reject other bids:", rejectError);

  // 3. Close the order
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .update({ status: "closed" })
    .eq("id", orderId)
    .select("id, status");

  console.log("[acceptBid] close order result — data:", orderData, "error:", orderError);

  if (orderError) console.error("[acceptBid] Failed to close order:", orderError);
  if (!orderData || orderData.length === 0) {
    console.error("[acceptBid] Order update matched 0 rows. Check RLS or orderId.");
  }

  // 4. Send notifications via admin client (bypasses RLS)
  const admin = createAdminClient();

  const { data: orderRow } = await admin
    .from("orders")
    .select("title")
    .eq("id", orderId)
    .single();
  const orderTitle = orderRow?.title ?? "your order";

  if (winningBid?.supplier_id) {
    await admin.from("notifications").insert({
      user_id: winningBid.supplier_id,
      title: "Your Bid Was Accepted",
      message: `Congratulations! Your bid on "${orderTitle}" was accepted. Prepare for delivery.`,
      is_read: false,
    });
  }

  if (rejectedData && rejectedData.length > 0) {
    const rejectedNotifications = rejectedData.map((b) => ({
      user_id: b.supplier_id,
      title: "Your Bid Was Not Selected",
      message: `The restaurant chose a different supplier for "${orderTitle}".`,
      is_read: false,
    }));
    await admin.from("notifications").insert(rejectedNotifications);
  }

  revalidatePath("/bids");
  revalidatePath("/dashboard");
}

export async function rejectBid(formData: FormData) {
  const bidId      = formData.get("bid_id")      as string;
  const supplierId = formData.get("supplier_id") as string | null;
  const orderId    = formData.get("order_id")    as string | null;

  const supabase = createClient();

  const { error } = await supabase
    .from("bids")
    .update({ status: "rejected" })
    .eq("id", bidId);

  if (error) console.error("Error rejecting bid:", error);

  if (supplierId) {
    const admin = createAdminClient();
    let orderTitle = "your order";
    if (orderId) {
      const { data } = await admin.from("orders").select("title").eq("id", orderId).single();
      orderTitle = data?.title ?? orderTitle;
    }
    await admin.from("notifications").insert({
      user_id: supplierId,
      title: "Your Bid Was Rejected",
      message: `Your bid on "${orderTitle}" was not selected by the restaurant.`,
      is_read: false,
    });
  }

  revalidatePath("/bids");
}
