"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// ─── claimDelivery ──────────────────────────────────────────────────────────
// Atomically claims a pending partner delivery (optimistic locking).

export async function claimDelivery(deliveryId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("deliveries")
    .update({
      delivery_partner_id: user.id,
      status:              "claimed",
      claimed_at:          now,
    })
    .eq("id", deliveryId)
    .eq("status", "pending")
    .is("delivery_partner_id", null)
    .select("id, restaurant_id, supplier_id, order_id, delivery_fee, orders(title)");

  if (error) {
    console.error("[claimDelivery] update error:", error);
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return { error: "This delivery was just taken by another partner. Please choose another." };
  }

  const delivery = data[0] as {
    id: string;
    restaurant_id: string;
    supplier_id: string;
    order_id: string;
    delivery_fee: number;
    orders: { title: string } | { title: string }[] | null;
  };

  const orderTitle = Array.isArray(delivery.orders)
    ? delivery.orders[0]?.title ?? "your order"
    : (delivery.orders as { title: string } | null)?.title ?? "your order";

  const { data: partnerProfile } = await supabase
    .from("delivery_partners")
    .select("business_name")
    .eq("id", user.id)
    .maybeSingle();
  const partnerName = partnerProfile?.business_name ?? "A delivery partner";

  const admin = createAdminClient();
  await admin.from("notifications").insert([
    {
      user_id: delivery.restaurant_id,
      title:   "Delivery Partner Assigned",
      message: `${partnerName} has been assigned to deliver "${orderTitle}" and will pick it up shortly.`,
      is_read: false,
      link:    `/orders/${delivery.order_id}`,
    },
    {
      user_id: delivery.supplier_id,
      title:   "Delivery Partner Assigned",
      message: `${partnerName} has been assigned to deliver "${orderTitle}".`,
      is_read: false,
      link:    `/supplier/dashboard`,
    },
  ]);

  revalidatePath("/delivery/dashboard");
  return {};
}

// ─── updateDeliveryStatus ────────────────────────────────────────────────────
// Valid transitions: claimed → picked_up → delivered
// Works for both delivery_partner and supplier (when delivery_method='supplier',
// delivery_partner_id is set to supplier_id at creation time).

export async function updateDeliveryStatus(
  deliveryId: string,
  newStatus: "picked_up" | "delivered"
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: current, error: fetchError } = await supabase
    .from("deliveries")
    .select("id, status, delivery_partner_id, delivery_method, order_id, restaurant_id, supplier_id, orders(title)")
    .eq("id", deliveryId)
    .eq("delivery_partner_id", user.id)
    .single();

  if (fetchError || !current) return { error: "Delivery not found" };

  const delivery = current as {
    id: string;
    status: string;
    delivery_partner_id: string;
    delivery_method: string;
    order_id: string;
    restaurant_id: string;
    supplier_id: string;
    orders: { title: string } | { title: string }[] | null;
  };

  const validTransitions: Record<string, string> = {
    picked_up: "claimed",
    delivered: "picked_up",
  };
  if (delivery.status !== validTransitions[newStatus]) {
    return { error: `Cannot transition from "${delivery.status}" to "${newStatus}"` };
  }

  const now            = new Date().toISOString();
  const timestampField = newStatus === "picked_up" ? "picked_up_at" : "delivered_at";

  const { error: updateError } = await supabase
    .from("deliveries")
    .update({ status: newStatus, [timestampField]: now })
    .eq("id", deliveryId)
    .eq("delivery_partner_id", user.id);

  if (updateError) return { error: updateError.message };

  const orderTitle = Array.isArray(delivery.orders)
    ? delivery.orders[0]?.title ?? "your order"
    : (delivery.orders as { title: string } | null)?.title ?? "your order";

  const isSupplierDelivery = delivery.delivery_method === "supplier";

  let delivererName: string;
  if (isSupplierDelivery) {
    delivererName = (user.user_metadata?.business_name as string | undefined) ?? "The supplier";
  } else {
    const { data: partnerProfile } = await supabase
      .from("delivery_partners")
      .select("business_name")
      .eq("id", user.id)
      .maybeSingle();
    delivererName = partnerProfile?.business_name ?? "The delivery partner";
  }

  const admin = createAdminClient();

  if (newStatus === "delivered") {
    await admin.from("orders").update({ status: "fulfilled" }).eq("id", delivery.order_id);

    // CHANGE 6: All rating links go to the supplier rating page regardless of delivery_type
    const ratingLink = `/bids/rate?supplierId=${delivery.supplier_id}&orderId=${delivery.order_id}&supplierName=${encodeURIComponent(delivererName)}`;

    const partnerRatingLink = `/delivery/rate/${deliveryId}`;

    const supplierNotifications: object[] = [
      {
        user_id: delivery.supplier_id,
        title:   "Delivery Completed",
        message: isSupplierDelivery
          ? `You have marked "${orderTitle}" as delivered.`
          : `"${orderTitle}" was successfully delivered by ${delivererName}.`,
        is_read: false,
        link:    `/supplier/dashboard`,
      },
    ];

    // When a delivery partner handled this, prompt the supplier to rate them
    if (!isSupplierDelivery) {
      supplierNotifications.push({
        user_id: delivery.supplier_id,
        title:   "Rate Your Delivery Partner",
        message: `How was ${delivererName}? Leave a rating for the delivery on "${orderTitle}".`,
        is_read: false,
        link:    partnerRatingLink,
      });
    }

    await admin.from("notifications").insert([
      {
        user_id: delivery.restaurant_id,
        title:   "Delivery Completed",
        message: `"${orderTitle}" has been delivered by ${delivererName}. Please rate your supplier.`,
        is_read: false,
        link:    ratingLink,
      },
      ...supplierNotifications,
    ]);
  } else {
    // picked_up
    await admin.from("notifications").insert([
      {
        user_id: delivery.restaurant_id,
        title:   "Order Picked Up",
        message: `${delivererName} has picked up "${orderTitle}" and is on the way.`,
        is_read: false,
        link:    `/orders/${delivery.order_id}`,
      },
      {
        user_id: delivery.supplier_id,
        title:   "Order Picked Up",
        message: isSupplierDelivery
          ? `You have marked "${orderTitle}" as picked up.`
          : `${delivererName} has picked up "${orderTitle}".`,
        is_read: false,
        link:    `/supplier/dashboard`,
      },
    ]);
  }

  revalidatePath("/delivery/dashboard");
  revalidatePath("/supplier/dashboard");
  return {};
}

// ─── selfDeliverFallback ─────────────────────────────────────────────────────
// Called when no partner claims in time and the supplier chooses to self-deliver.

export async function selfDeliverFallback(deliveryId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const now = new Date().toISOString();

  // Only allow if: still pending, supplier owns this delivery
  const { data, error } = await supabase
    .from("deliveries")
    .update({
      delivery_method:     "supplier",
      delivery_partner_id: user.id,
      status:              "claimed",
      claimed_at:          now,
    })
    .eq("id", deliveryId)
    .eq("supplier_id", user.id)
    .eq("status", "pending")
    .select("id, restaurant_id, order_id, orders(title)");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Could not convert delivery — it may have been claimed." };

  const delivery = data[0] as {
    id: string;
    restaurant_id: string;
    order_id: string;
    orders: { title: string } | { title: string }[] | null;
  };

  const orderTitle = Array.isArray(delivery.orders)
    ? delivery.orders[0]?.title ?? "your order"
    : (delivery.orders as { title: string } | null)?.title ?? "your order";

  const delivererName = (user.user_metadata?.business_name as string | undefined) ?? "The supplier";

  const admin = createAdminClient();
  await admin.from("notifications").insert({
    user_id: delivery.restaurant_id,
    title:   "Supplier Will Deliver",
    message: `No delivery partner was found in time. ${delivererName} will deliver "${orderTitle}" themselves.`,
    is_read: false,
    link:    `/orders/${delivery.order_id}`,
  });

  revalidatePath("/supplier/dashboard");
  return {};
}

// ─── cancelDeliveryFallback ──────────────────────────────────────────────────
// Called when no partner claims and the supplier cancels the order.

export async function cancelDeliveryFallback(deliveryId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch delivery info
  const { data: delivery, error: fetchError } = await supabase
    .from("deliveries")
    .select("id, restaurant_id, supplier_id, order_id, status, orders(title)")
    .eq("id", deliveryId)
    .eq("supplier_id", user.id)
    .single();

  if (fetchError || !delivery) return { error: "Delivery not found." };
  if (delivery.status !== "pending") return { error: "Delivery is no longer in a cancellable state." };

  const del = delivery as {
    id: string;
    restaurant_id: string;
    supplier_id: string;
    order_id: string;
    status: string;
    orders: { title: string } | { title: string }[] | null;
  };

  const orderTitle = Array.isArray(del.orders)
    ? del.orders[0]?.title ?? "your order"
    : (del.orders as { title: string } | null)?.title ?? "your order";

  // Cancel the order
  const { error: cancelError } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", del.order_id);

  if (cancelError) return { error: cancelError.message };

  const admin = createAdminClient();
  await admin.from("notifications").insert([
    {
      user_id: del.restaurant_id,
      title:   "Order Cancelled",
      message: `The supplier cancelled order "${orderTitle}" because no delivery partner was found.`,
      is_read: false,
      link:    `/dashboard`,
    },
    {
      user_id: del.supplier_id,
      title:   "Order Cancelled",
      message: `You have cancelled "${orderTitle}" due to no delivery partner being available.`,
      is_read: false,
      link:    `/supplier/dashboard`,
    },
  ]);

  revalidatePath("/supplier/dashboard");
  revalidatePath("/delivery/dashboard");
  return {};
}

// ─── updateDeliveryPartnerProfile ───────────────────────────────────────────

export async function updateDeliveryPartnerProfile(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const phone         = formData.get("phone")         as string | null;
  const vehicle_type  = formData.get("vehicle_type")  as string | null;
  const is_available  = formData.get("is_available") === "true";
  const business_name = formData.get("business_name") as string | null;
  const postal_code   = formData.get("postal_code")   as string | null;
  const prefecture    = formData.get("prefecture")    as string | null;
  const city_ward     = formData.get("city_ward")     as string | null;
  const block_banchi  = formData.get("block_banchi")  as string | null;

  // Resolve coordinates from updated postal code
  let latitude:  number | null = null;
  let longitude: number | null = null;
  if (postal_code) {
    const { resolveCoords } = await import("@/lib/jp_postal");
    const coords = resolveCoords(postal_code, prefecture ?? undefined);
    if (coords) { latitude = coords.lat; longitude = coords.lng; }
  }

  const { error } = await supabase
    .from("delivery_partners")
    .upsert({
      id: user.id,
      business_name: business_name ?? undefined,
      phone:         phone         ?? null,
      vehicle_type:  vehicle_type  ?? null,
      is_available,
      postal_code:   postal_code   ?? null,
      prefecture:    prefecture    ?? null,
      city_ward:     city_ward     ?? null,
      block_banchi:  block_banchi  ?? null,
      latitude,
      longitude,
      updated_at:    new Date().toISOString(),
    });

  if (error) return { error: error.message };

  revalidatePath("/delivery/settings");
  revalidatePath("/delivery/dashboard");
  return {};
}

// ─── rateDeliveryPartner ────────────────────────────────────────────────────

export async function rateDeliveryPartner(
  deliveryId: string,
  deliveryPartnerId: string,
  rating: number,
  review: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error: insertError } = await supabase
    .from("delivery_ratings")
    .insert({
      delivery_id:         deliveryId,
      delivery_partner_id: deliveryPartnerId,
      rated_by:            user.id,
      rating,
      review: review.trim() || null,
    });

  if (insertError) {
    if (insertError.code === "23505") return { error: "You have already rated this delivery." };
    return { error: insertError.message };
  }

  const admin = createAdminClient();
  const { data: allRatings } = await admin
    .from("delivery_ratings")
    .select("rating")
    .eq("delivery_partner_id", deliveryPartnerId);

  if (allRatings && allRatings.length > 0) {
    const avg = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
    await admin
      .from("delivery_partners")
      .update({
        average_rating: parseFloat(avg.toFixed(2)),
        total_ratings:  allRatings.length,
        updated_at:     new Date().toISOString(),
      })
      .eq("id", deliveryPartnerId);
  }

  revalidatePath(`/delivery/rate/${deliveryId}`);
  return {};
}
