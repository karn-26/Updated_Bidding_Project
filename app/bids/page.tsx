import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Bid } from "@/types";

const placeholderBids: (Bid & { order_title: string })[] = [
  {
    id: "bid_001", order_id: "ord_001", order_title: "Weekly produce order",
    supplier_id: "sup_01", supplier_name: "Green Valley Farms",
    price: 340, notes: "Same-day delivery available. All organic certified.",
    status: "pending", created_at: "2026-03-05T09:00:00Z",
  },
  {
    id: "bid_002", order_id: "ord_001", order_title: "Weekly produce order",
    supplier_id: "sup_02", supplier_name: "City Fresh Co.",
    price: 295, notes: "Next-morning delivery. Minimum order $200.",
    status: "pending", created_at: "2026-03-05T11:30:00Z",
  },
  {
    id: "bid_003", order_id: "ord_002", order_title: "Dry goods — pasta & rice",
    supplier_id: "sup_03", supplier_name: "Metro Wholesale",
    price: 180, notes: "Bulk pricing applied. Can split delivery if needed.",
    status: "accepted", created_at: "2026-03-04T14:00:00Z",
  },
];

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Pending",  cls: "bg-amber-100 text-amber-700" },
  accepted: { label: "Accepted", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-600" },
};

export default async function BidsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Bids</h1>
            <p className="mt-1 text-sm text-slate-500">
              Review and respond to supplier bids on your orders.
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
          {["All", "Pending", "Accepted", "Rejected"].map((tab, i) => (
            <button
              key={tab}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                i === 0
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Bid cards */}
        <div className="space-y-4">
          {placeholderBids.map((bid) => {
            const s = statusConfig[bid.status];
            return (
              <div key={bid.id} className="card p-6 transition hover:shadow-card-hover">
                {/* Top row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                      {bid.order_title}
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
                    <button className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98]">
                      Accept bid
                    </button>
                    <button className="btn-danger flex-1">
                      Decline
                    </button>
                  </div>
                )}

                {bid.status === "accepted" && (
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

        {placeholderBids.length === 0 && (
          <div className="card py-20 text-center">
            <p className="text-slate-400">No bids received yet.</p>
            <p className="mt-1 text-sm text-slate-400">Post an order to start receiving bids from suppliers.</p>
            <Link href="/orders/new" className="btn-primary mx-auto mt-6 inline-flex">Post an order</Link>
          </div>
        )}
      </div>
    </div>
  );
}
