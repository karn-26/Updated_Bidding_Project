import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeliveryStageTracker from "@/components/delivery/DeliveryStageTracker";

const statusConfig: Record<string, { label: string; cls: string }> = {
  open:        { label: "Open",        cls: "bg-emerald-100 text-emerald-700" },
  closed:      { label: "Closed",      cls: "bg-slate-100 text-slate-600"    },
  cancelled:   { label: "Cancelled",   cls: "bg-red-100 text-red-600"        },
  in_delivery: { label: "In Delivery", cls: "bg-indigo-100 text-indigo-700"  },
  fulfilled:   { label: "Fulfilled",   cls: "bg-emerald-100 text-emerald-700"},
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, title, status, deadline, created_at")
    .eq("id", id)
    .eq("restaurant_id", user.id)
    .single();

  if (orderError) console.error("Error fetching order:", orderError);
  if (!order) notFound();

  const { data: items } = await supabase
    .from("order_items")
    .select("id, name, quantity, unit")
    .eq("order_id", id)
    .order("id");

  // Fetch delivery including delivery_method and supplier_id for routing rating link
  const { data: delivery } = await supabase
    .from("deliveries")
    .select(`
      id, status, delivery_method, pickup_address, dropoff_address,
      supplier_id, claimed_at, picked_up_at, delivered_at,
      delivery_partners ( business_name, average_rating, total_ratings )
    `)
    .eq("order_id", id)
    .maybeSingle();

  const orderItems = items ?? [];
  const s          = statusConfig[order.status] ?? statusConfig.open;

  const datePlaced = new Date(order.created_at).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  type PartnerRow = { business_name: string; average_rating: number; total_ratings: number };
  const partner = delivery
    ? (Array.isArray(delivery.delivery_partners)
        ? (delivery.delivery_partners as PartnerRow[])[0]
        : delivery.delivery_partners as PartnerRow | null)
    : null;

  const isSupplierDelivery = delivery?.delivery_method === "supplier";

  const deliveredByLabel = isSupplierDelivery
    ? "Delivered by supplier"
    : partner
      ? `Partner: ${partner.business_name}${partner.total_ratings > 0 ? ` ★${partner.average_rating.toFixed(1)}` : ""}`
      : "Awaiting delivery partner";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">

        {/* Back link */}
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Title row */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">{order.title}</h1>
            <p className="mt-1 text-sm text-slate-500">Placed on {datePlaced}</p>
          </div>
          <span className={`badge mt-1 shrink-0 ${s.cls}`}>{s.label}</span>
        </div>

        <div className="space-y-5">
          {/* Order meta */}
          <div className="card p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Order Details
            </p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-400">Status</dt>
                <dd className="mt-1"><span className={`badge ${s.cls}`}>{s.label}</span></dd>
              </div>
              <div>
                <dt className="text-slate-400">Date placed</dt>
                <dd className="mt-0.5 font-semibold text-slate-800">{datePlaced}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Bid deadline</dt>
                <dd className="mt-0.5 font-semibold text-slate-800">{order.deadline}</dd>
              </div>
            </dl>
          </div>

          {/* Items table */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">
                Items
                <span className="ml-2 text-sm font-normal text-slate-400">
                  {orderItems.length} item{orderItems.length !== 1 ? "s" : ""}
                </span>
              </h2>
            </div>
            {orderItems.length > 0 ? (
              <>
                <div className="grid grid-cols-[1fr_80px_100px] gap-3 border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  <span>Item name</span>
                  <span className="text-right">Qty</span>
                  <span>Unit</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {orderItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_80px_100px] gap-3 px-5 py-3 text-sm">
                      <span className="font-medium text-slate-800">{item.name}</span>
                      <span className="text-right font-semibold text-slate-700">{item.quantity}</span>
                      <span className="text-slate-500">{item.unit}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-slate-400">No items found.</p>
            )}
          </div>

          {/* Delivery section */}
          {delivery && (
            <div className="card p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Delivery
              </p>

              {/* Live stage tracker */}
              <DeliveryStageTracker
                deliveryId={delivery.id}
                initialStatus={delivery.status}
                initialClaimedAt={delivery.claimed_at}
                initialPickedUpAt={delivery.picked_up_at}
                initialDeliveredAt={delivery.delivered_at}
                deliveredByLabel={deliveredByLabel}
                canUpdate={false}
              />

              {/* Addresses */}
              <dl className="mt-5 grid grid-cols-1 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-400">Pickup address</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{delivery.pickup_address ?? "TBC"}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Dropoff address</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{delivery.dropoff_address ?? "TBC"}</dd>
                </div>
              </dl>

              {/* Rating link — shown only after delivery is complete */}
              {delivery.status === "delivered" && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  {isSupplierDelivery ? (
                    <Link
                      href={`/bids/rate?supplierId=${delivery.supplier_id}&orderId=${id}`}
                      className="text-sm font-semibold text-amber-600 underline hover:text-amber-700"
                    >
                      Rate your supplier →
                    </Link>
                  ) : (
                    <Link
                      href={`/delivery/rate/${delivery.id}`}
                      className="text-sm font-semibold text-amber-600 underline hover:text-amber-700"
                    >
                      Rate your delivery partner →
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Link href={`/bids?order=${order.id}`} className="btn-primary">
              View bids for this order
            </Link>
            <Link href="/dashboard" className="btn-secondary">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
