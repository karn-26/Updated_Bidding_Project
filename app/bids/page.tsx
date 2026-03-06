import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { acceptBid, rejectBid } from "./actions";

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Pending",  cls: "bg-amber-100 text-amber-700"   },
  won:      { label: "Accepted", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-600"       },
};

// Maps the URL ?status= value to the DB status stored in Supabase
const STATUS_MAP: Record<string, string> = {
  pending:  "pending",
  accepted: "won",
  rejected: "rejected",
};

const TABS = [
  { label: "All",      key: null       },
  { label: "Pending",  key: "pending"  },
  { label: "Accepted", key: "accepted" },
  { label: "Rejected", key: "rejected" },
];

export default async function BidsPage({
  searchParams,
}: {
  searchParams: { order?: string; status?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const orderFilter = searchParams.order ?? null;
  const activeTab   = searchParams.status ?? null;  // e.g. "pending" | "accepted" | "rejected" | null
  const dbStatus    = activeTab ? (STATUS_MAP[activeTab] ?? null) : null;

  // When filtering by order, fetch its title for the header (handles zero-bids case too)
  let orderTitle: string | null = null;
  if (orderFilter) {
    const { data: orderRow } = await supabase
      .from("orders")
      .select("title")
      .eq("id", orderFilter)
      .eq("restaurant_id", user.id)
      .single();
    orderTitle = orderRow?.title ?? null;
  }

  let query = supabase
    .from("bids")
    .select(`
      id,
      order_id,
      supplier_id,
      supplier_name,
      price,
      notes,
      status,
      created_at,
      orders!inner ( title, restaurant_id )
    `)
    .eq("orders.restaurant_id", user.id)
    .order("created_at", { ascending: false });

  if (orderFilter) query = query.eq("order_id", orderFilter);
  if (dbStatus)    query = query.eq("status", dbStatus);

  const { data: bidsData, error: bidsError } = await query;

  if (bidsError) console.error("Supabase error fetching bids:", bidsError);

  const bids = bidsData ?? [];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {orderFilter && (
              <Link
                href="/dashboard"
                className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back to Dashboard
              </Link>
            )}
            <h1 className="text-2xl font-extrabold text-slate-900">
              {orderTitle ? `Bids for "${orderTitle}"` : "All Bids"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {orderFilter
                ? `${bids.length} bid${bids.length !== 1 ? "s" : ""} received on this order.`
                : "Review and respond to supplier bids on your orders."}
            </p>
          </div>
          <Link href="/orders/new" className="btn-primary self-start sm:self-auto">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Order
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
          {TABS.map(({ label, key }) => {
            const isActive = activeTab === key;
            const params = new URLSearchParams();
            if (orderFilter) params.set("order", orderFilter);
            if (key)         params.set("status", key);
            const href = `/bids${params.size > 0 ? `?${params}` : ""}`;
            return (
              <Link
                key={label}
                href={href}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Bid cards */}
        <div className="space-y-4">
          {bids.map((bid) => {
            const s = statusConfig[bid.status] ?? statusConfig.pending;
            const orderTitle = (bid.orders as { title: string }[] | null)?.[0]?.title ?? "—";
            return (
              <div key={bid.id} className="card p-6 transition hover:shadow-card-hover">
                {/* Top row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                      {orderTitle}
                    </p>
                    <h3 className="truncate text-lg font-bold text-slate-900">{bid.supplier_name}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{bid.notes}</p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-2xl font-extrabold text-slate-900">
                      ${bid.price.toLocaleString()}
                    </p>
                    <span className={`badge mt-1.5 ${s.cls}`}>{s.label}</span>
                  </div>
                </div>

                {/* Actions */}
                {bid.status === "pending" && (
                  <div className="mt-5 flex gap-3 border-t border-slate-100 pt-4">
                    <form action={acceptBid}>
                      <input type="hidden" name="bid_id" value={bid.id} />
                      <input type="hidden" name="order_id" value={bid.order_id} />
                      <button
                        type="submit"
                        className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98]"
                      >
                        Accept bid
                      </button>
                    </form>
                    <form action={rejectBid}>
                      <input type="hidden" name="bid_id"      value={bid.id} />
                      <input type="hidden" name="supplier_id" value={bid.supplier_id} />
                      <input type="hidden" name="order_id"    value={bid.order_id} />
                      <button type="submit" className="btn-danger">
                        Decline
                      </button>
                    </form>
                  </div>
                )}

                {bid.status === "won" && (
                  <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                      <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-emerald-700">Bid accepted — awaiting delivery</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {bids.length === 0 && (
          <div className="card py-20 text-center">
            <p className="text-slate-400">
              {orderFilter ? "No bids received on this order yet." : "No bids received yet."}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {orderFilter
                ? "Suppliers will be able to submit bids while the order is open."
                : "Post an order to start receiving bids from suppliers."}
            </p>
            {!orderFilter && (
              <Link href="/orders/new" className="btn-primary mx-auto mt-6 inline-flex">Post an order</Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
