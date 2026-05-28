"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ── How long (hours) to wait for a partner to claim before fallback fires ──
const PARTNER_DEADLINE_HOURS = 24;

export async function acceptBid(formData: FormData) {
  const bidId   = formData.get("bid_id")   as string | null;
  const orderId = formData.get("order_id") as string | null;

  if (!bidId || !orderId) {
    console.error("[acceptBid] Missing bidId or orderId — aborting.");
    return;
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user) {
    console.error("[acceptBid] No authenticated user — aborting.", authError);
    return;
  }

  const admin = createAdminClient();

  // 0. Fetch the winning bid to get supplier info + delivery_type + delivery_fee
  const { data: winningBid } = await admin
    .from("bids")
    .select("id, supplier_id, supplier_name, delivery_type, delivery_fee")
    .eq("id", bidId)
    .single();

  if (!winningBid) {
    console.error("[acceptBid] Winning bid not found.");
    return;
  }

  const supplierId    = winningBid.supplier_id   ?? "";
  const deliveryType  = (winningBid.delivery_type  as "supplier" | "partner") ?? "supplier";
  const deliveryFee   = (winningBid.delivery_fee   as number) ?? 0;
  // Map bid.delivery_type to delivery.delivery_method column values
  const deliveryMethod = deliveryType === "partner" ? "delivery_partner" : "supplier";

  // 1. Mark the winning bid as 'won'
  const { data: wonData, error: winError } = await supabase
    .from("bids")
    .update({ status: "won" })
    .eq("id", bidId)
    .select("id, status");

  if (winError || !wonData || wonData.length === 0) {
    console.error("[acceptBid] Failed to set winning bid:", winError);
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

  // 3. Move order to 'in_delivery'
  const { error: orderError } = await supabase
    .from("orders")
    .update({ status: "in_delivery" })
    .eq("id", orderId);

  if (orderError) console.error("[acceptBid] Failed to update order status:", orderError);

  // 4. Fetch order details
  const { data: orderRow } = await admin
    .from("orders")
    .select("title, restaurant_id")
    .eq("id", orderId)
    .single();

  const orderTitle   = orderRow?.title        ?? "your order";
  const restaurantId = orderRow?.restaurant_id ?? user.id;

  // 5. Fetch supplier address + coords for pickup
  const { data: supplierProfile } = await admin
    .from("supplier_profiles")
    .select("postal_code, prefecture, city_ward, block_banchi, latitude, longitude, city, country")
    .eq("id", supplierId)
    .maybeSingle();

  // 6. Fetch restaurant address + coords for dropoff
  const { data: restaurantProfile } = await admin
    .from("restaurant_profiles")
    .select("postal_code, prefecture, city_ward, block_banchi, latitude, longitude")
    .eq("id", restaurantId)
    .maybeSingle();

  // Fallback to user_metadata for restaurant coords if profile not populated yet
  const { data: restaurantUserData } = await admin.auth.admin.getUserById(restaurantId);
  const restaurantMeta = restaurantUserData?.user?.user_metadata;

  const pickupAddress = supplierProfile
    ? [supplierProfile.prefecture, supplierProfile.city_ward, supplierProfile.block_banchi]
        .filter(Boolean).join(" ")
    : (supplierProfile as null)
    ?? null;

  const dropoffAddress = restaurantProfile
    ? [restaurantProfile.prefecture, restaurantProfile.city_ward, restaurantProfile.block_banchi]
        .filter(Boolean).join(" ")
    : (restaurantMeta?.prefecture && restaurantMeta?.city_ward
      ? `${restaurantMeta.prefecture} ${restaurantMeta.city_ward}`
      : null);

  const pickupLat  = supplierProfile?.latitude  ?? null;
  const pickupLng  = supplierProfile?.longitude ?? null;
  const dropoffLat = restaurantProfile?.latitude  ?? (restaurantMeta?.latitude  as number | null | undefined) ?? null;
  const dropoffLng = restaurantProfile?.longitude ?? (restaurantMeta?.longitude as number | null | undefined) ?? null;

  const isSupplierDelivery = deliveryType === "supplier";

  // 7. Compute partner_deadline (only for partner deliveries)
  const partnerDeadline = !isSupplierDelivery
    ? new Date(Date.now() + PARTNER_DEADLINE_HOURS * 60 * 60 * 1000).toISOString()
    : null;

  // 8. Create delivery record
  const { data: delivery, error: deliveryError } = await admin
    .from("deliveries")
    .insert({
      order_id:           orderId,
      bid_id:             bidId,
      restaurant_id:      restaurantId,
      supplier_id:        supplierId,
      delivery_method:    deliveryMethod,
      delivery_fee:       deliveryFee,
      pickup_address:     pickupAddress,
      dropoff_address:    dropoffAddress,
      pickup_lat:         pickupLat,
      pickup_lng:         pickupLng,
      dropoff_lat:        dropoffLat,
      dropoff_lng:        dropoffLng,
      partner_deadline:   partnerDeadline,
      ...(isSupplierDelivery
        ? {
            delivery_partner_id: supplierId,
            status:              "claimed",
            claimed_at:          new Date().toISOString(),
          }
        : {
            delivery_partner_id: null,
            status:              "pending",
          }),
    })
    .select("id")
    .single();

  if (deliveryError) {
    console.error("[acceptBid] Failed to create delivery record:", deliveryError);
  }

  // 9. Notify winning supplier
  if (supplierId) {
    const supplierMessage = isSupplierDelivery
      ? `Congratulations! Your bid on "${orderTitle}" was accepted. You are responsible for delivering this order — please update the delivery stages from your dashboard.`
      : `Congratulations! Your bid on "${orderTitle}" was accepted. The platform will find a delivery partner. You will be notified once one is assigned.`;

    await admin.from("notifications").insert({
      user_id: supplierId,
      title:   "Your Bid Was Accepted",
      message: supplierMessage,
      is_read: false,
      link:    `/supplier/dashboard`,
    });
  }

  // 10. Notify rejected suppliers
  if (rejectedData && rejectedData.length > 0) {
    await admin.from("notifications").insert(
      rejectedData.map((b) => ({
        user_id: b.supplier_id,
        title:   "Your Bid Was Not Selected",
        message: `The restaurant chose a different supplier for "${orderTitle}".`,
        is_read: false,
        link:    `/supplier/dashboard`,
      }))
    );
  }

  // 11. Notify restaurant about pending partner assignment
  if (!isSupplierDelivery) {
    await admin.from("notifications").insert({
      user_id: restaurantId,
      title:   "Finding a Delivery Partner",
      message: `Your order "${orderTitle}" has been accepted. We are finding a delivery partner — you will be notified once one is assigned.`,
      is_read: false,
      link:    `/bids`,
    });
  }

  // 12. Fan-out to delivery partners when using the partner method
  if (!isSupplierDelivery && delivery?.id) {
    fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/notify-new-delivery`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ deliveryId: delivery.id, orderTitle, deliveryFee }),
      }
    ).catch((e) => console.error("[acceptBid] notify-new-delivery failed:", e));
  }

  revalidatePath("/bids");
  revalidatePath("/dashboard");
  revalidatePath("/orders");

  redirect("/bids");
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
      link:    `/supplier/dashboard`,
    });
  }

  revalidatePath("/bids");
}
