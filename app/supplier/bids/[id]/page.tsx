import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import EditBidForm from "@/components/supplier/EditBidForm";

const statusConfig: Record<string, { label: string; cardCls: string; badgeCls: string }> = {
  pending:  { label: "Pending",  cardCls: "border-slate-200 bg-white",       badgeCls: "bg-amber-100 text-amber-700"    },
  won:      { label: "Accepted", cardCls: "border-emerald-300 bg-emerald-50", badgeCls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejected", cardCls: "border-red-300 bg-red-50",         badgeCls: "bg-red-100 text-red-700"        },
};

export default async function BidDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // 1. Fetch the bid (scoped to this supplier)
  const { data: bid, error: bidError } = await supabase
    .from("bids")
    .select("id, order_id, price, delivery_date, notes, status, created_at")
    .eq("id", params.id)
    .eq("supplier_id", user.id)
    .single();

  if (bidError) console.error("Error fetching bid:", bidError);
  if (!bid) notFound();

  // 2 & 3. Use admin client for order + items — the supplier RLS policy only allows
  //    SELECT on orders/order_items with status = 'open', but accepted bids have
  //    status = 'closed'. Ownership is already verified above via the bid query.
  const admin = createAdminClient();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, title, deadline, status")
    .eq("id", bid.order_id)
    .single();

  if (orderError) console.error("Error fetching order:", orderError);
  if (!order) notFound();

  const { data: orderItemsData, error: itemsError } = await admin
    .from("order_items")
    .select("id, name, quantity, unit")
    .eq("order_id", bid.order_id);

  if (itemsError) console.error("Error fetching order items:", itemsError);

  const orderItems = orderItemsData ?? [];
  const s = statusConfig[bid.status] ?? statusConfig.pending;
  const isWon      = bid.status === "won";
  const isRejected = bid.status === "rejected";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">

        {/* Back link */}
        <Link
          href="/supplier/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Page title */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Bid Detail</h1>
            <p className="mt-1 text-sm text-slate-500">
              Submitted {new Date(bid.created_at).toLocaleDateString("en-US", {
                year: "numeric", month: "long", day: "numeric",
              })}
            </p>
          </div>
          <span className={`badge mt-1 shrink-0 ${s.badgeCls}`}>{s.label}</span>
        </div>

        <div className="space-y-5">
          {/* Status banner */}
          {isWon && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-emerald-800">Your bid was accepted</p>
                <p className="mt-0.5 text-sm text-emerald-700">
                  The restaurant has chosen your offer. Prepare for delivery by{" "}
                  <span className="font-medium">{bid.delivery_date}</span>.
                </p>
              </div>
            </div>
          )}

          {isRejected && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-red-700">Your bid was not selected</p>
                <p className="mt-0.5 text-sm text-red-600">
                  The restaurant chose a different supplier for this order.
                </p>
              </div>
            </div>
          )}

          {/* Order details */}
          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Order</p>
            </div>
            <div className="p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">{order.title}</h2>
                <span className={`badge shrink-0 ${order.status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>

              <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-slate-400">Bid deadline</dt>
                  <dd className="mt-0.5 font-semibold text-slate-800">{order.deadline}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Items requested</dt>
                  <dd className="mt-0.5 font-semibold text-slate-800">{orderItems.length}</dd>
                </div>
              </dl>

              {/* Items table */}
              <div className="overflow-hidden rounded-xl border border-slate-100">
                <div className="grid grid-cols-[1fr_80px_80px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  <span>Item</span>
                  <span className="text-right">Qty</span>
                  <span>Unit</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {orderItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_80px_80px] gap-3 px-4 py-3 text-sm">
                      <span className="font-medium text-slate-800">{item.name}</span>
                      <span className="text-right font-semibold text-slate-700">{item.quantity}</span>
                      <span className="text-slate-500">{item.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bid details */}
          <div className={`card overflow-hidden border ${s.cardCls}`}>
            <div className="flex items-center justify-between border-b border-inherit bg-white/60 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Your Bid</p>
              <span className={`badge ${s.badgeCls}`}>{s.label}</span>
            </div>

            {bid.status === "pending" ? (
              <EditBidForm
                bidId={bid.id}
                initialPrice={bid.price}
                initialDeliveryDate={bid.delivery_date}
                initialNotes={bid.notes}
                orderDeadline={order.deadline}
              />
            ) : (
              <div className="p-5">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <dt className="text-slate-400">Bid amount</dt>
                    <dd className={`mt-0.5 text-2xl font-extrabold ${isWon ? "text-emerald-700" : "text-red-600"}`}>
                      ${bid.price.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Proposed delivery</dt>
                    <dd className="mt-0.5 font-semibold text-slate-800">{bid.delivery_date ?? "—"}</dd>
                  </div>
                  {bid.notes && (
                    <div className="col-span-2">
                      <dt className="text-slate-400">Notes</dt>
                      <dd className="mt-0.5 leading-relaxed text-slate-700">{bid.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
