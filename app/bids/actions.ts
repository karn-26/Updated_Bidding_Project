"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function acceptBid(formData: FormData) {
  const bidId   = formData.get("bid_id")   as string | null;
  const orderId = formData.get("order_id") as string | null;

  console.log("[acceptBid] called with bidId:", bidId, "orderId:", orderId);

  if (!bidId || !orderId) {
    console.error("[acceptBid] Missing bidId or orderId — aborting.");
    return;
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log("[acceptBid] auth user:", user?.id ?? null, "authError:", authError);
  if (!user) {
    console.error("[acceptBid] No authenticated user — aborting.");
    return;
  }

  // 0. Fetch the winning bid to get supplier_id, supplier_name
  const { data: winningBid } = await supabase
    .from("bids")
    .select("id, supplier_id, supplier_name")
    .eq("id", bidId)
    .single();

  // 1. Mark the winning bid as 'won'
  const { data: wonData, error: winError } = await supabase
    .from("bids")
    .update({ status: "won" })
    .eq("id", bidId)
    .select("id, status");

  console.log("[acceptBid] set winning bid — data:", wonData, "error:", winError);

  if (winError) {
    console.error("[acceptBid] Failed to set winning bid:", winError);
    return;
  }
  if (!wonData || wonData.length === 0) {
    console.error("[acceptBid] Winning bid update matched 0 rows.");
    return;
  }

  // 2. Reject every other bid on the same order
  const { data: rejectedData, error: rejectError } = await supabase
    .from("bids")
    .update({ status: "rejected" })
    .eq("order_id", orderId)
    .neq("id", bidId)
    .select("id, supplier_id");

  if (rejectError) console.error("[acceptBid] Failed to reject other bids:", rejectError);

  // 3. Move order to 'in_delivery' (was 'closed')
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .update({ status: "in_delivery" })
    .eq("id", orderId)
    .select("id, status, title");

  if (orderError) console.error("[acceptBid] Failed to update order status:", orderError);
  if (!orderData || orderData.length === 0) {
    console.error("[acceptBid] Order update matched 0 rows.");
  }

  const admin = createAdminClient();

  // 4. Fetch order details for notifications and delivery record
  const { data: orderRow } = await admin
    .from("orders")
    .select("title, restaurant_id")
    .eq("id", orderId)
    .single();

  const orderTitle   = orderRow?.title        ?? "your order";
  const restaurantId = orderRow?.restaurant_id ?? user.id;

  // 5. Fetch supplier's city for pickup_address placeholder
  const { data: supplierProfile } = await admin
    .from("supplier_profiles")
    .select("city, country")
    .eq("id", winningBid?.supplier_id ?? "")
    .maybeSingle();

  // 6. Fetch restaurant owner's city for dropoff_address placeholder
  const { data: restaurantUser } = await admin.auth.admin.getUserById(restaurantId);
  const restaurantCity =
    restaurantUser?.user?.user_metadata?.city as string | undefined;

  // 7. Create delivery record (admin bypasses RLS)
  const { data: delivery, error: deliveryError } = await admin
    .from("deliveries")
    .insert({
      order_id:        orderId,
      bid_id:          bidId,
      restaurant_id:   restaurantId,
      supplier_id:     winningBid?.supplier_id ?? "",
      pickup_address:  supplierProfile?.city
        ? `${supplierProfile.city}${supplierProfile.country ? `, ${supplierProfile.country}` : ""}`
        : null,
      dropoff_address: restaurantCity ?? null,
      status:          "pending",
    })
    .select("id")
    .single();

  if (deliveryError) {
    console.error("[acceptBid] Failed to create delivery record:", deliveryError);
  }

  // 8. Send notifications via admin client
  // 8a. Winning supplier
  if (winningBid?.supplier_id) {
    await admin.from("notifications").insert({
      user_id: winningBid.supplier_id,
      title:   "Your Bid Was Accepted",
      message: `Congratulations! Your bid on "${orderTitle}" was accepted. A delivery partner will be assigned shortly.`,
      is_read: false,
      link:    `/supplier/bids/${winningBid.id}`,
    });
  }

  // 8b. Rejected suppliers
  if (rejectedData && rejectedData.length > 0) {
    const rejectedNotifications = rejectedData.map((b) => ({
      user_id: b.supplier_id,
      title:   "Your Bid Was Not Selected",
      message: `The restaurant chose a different supplier for "${orderTitle}".`,
      is_read: false,
      link:    `/supplier/bids/${b.id}`,
    }));
    await admin.from("notifications").insert(rejectedNotifications);
  }

  // 8c. Fan-out to all delivery partners (fire-and-forget via API route)
  //     We don't await so this doesn't slow down the redirect.
  if (delivery?.id) {
    fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/notify-new-delivery`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ deliveryId: delivery.id, orderTitle }),
      }
    ).catch((e) => console.error("[acceptBid] notify-new-delivery failed:", e));
  }

  revalidatePath("/bids");
  revalidatePath("/dashboard");

  // Redirect to supplier rating page
  const supplierName = encodeURIComponent(winningBid?.supplier_name ?? "");
  redirect(
    `/bids/rate?supplierId=${winningBid?.supplier_id}&orderId=${orderId}&supplierName=${supplierName}`
  );
}

export async function rejectBid(formData: FormData) {
  const bidId      = formData.get("bid_id")      as string;
  const supplierId = formData.get("supplier_id") as string | null;
  const orderId    = formData.get("order_id")    as string | null;

  const supabase = await createClient();

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
      title:   "Your Bid Was Rejected",
      message: `Your bid on "${orderTitle}" was not selected by the restaurant.`,
      is_read: false,
      link:    `/supplier/bids/${bidId}`,
    });
  }

  revalidatePath("/bids");
}
