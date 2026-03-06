import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const openOrders = [
  {
    id: "ord_001",
    title: "Weekly produce order",
    restaurant: "The Golden Fork",
    items: ["Tomatoes 20kg", "Lettuce 10 heads", "Onions 15kg"],
    deadline: "2026-03-10",
    bids: 3,
  },
  {
    id: "ord_002",
    title: "Dry goods — pasta & rice",
    restaurant: "Bella Cucina",
    items: ["Pasta 50kg", "Rice 30kg", "Olive oil 10L"],
    deadline: "2026-03-12",
    bids: 1,
  },
  {
    id: "ord_004",
    title: "Fresh seafood delivery",
    restaurant: "Harbour House",
    items: ["Salmon fillet 8kg", "Prawns 5kg", "Sea bass 4kg"],
    deadline: "2026-03-08",
    bids: 0,
  },
];

const myBids = [
  { id: "bid_001", order_title: "Weekly produce order",  price: 340, status: "pending"  },
  { id: "bid_003", order_title: "Dairy & cheese bundle", price: 210, status: "accepted" },
];

const bidStatusConfig: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Pending",  cls: "bg-amber-100 text-amber-700"     },
  accepted: { label: "Accepted", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-600"         },
};

export default async function SupplierDashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.user_metadata?.role === "restaurant_owner") redirect("/dashboard");

  const businessName = user.user_metadata?.business_name ?? "there";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Good morning, {businessName} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Browse open orders and manage your bids.
          </p>
        </div>

        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon="📦" label="Open Orders Available" value={openOrders.length}                                   color="indigo" />
          <StatCard icon="📝" label="Bids Placed"           value={myBids.length}                                      color="amber"  />
          <StatCard icon="🏆" label="Bids Accepted"         value={myBids.filter((b) => b.status === "accepted").length} color="emerald" />
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* ── Open orders (main column) ── */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-semibold text-slate-900">Open Orders</h2>

            {openOrders.map((order) => (
              <div key={order.id} className="card p-6 transition hover:shadow-card-hover">
                {/* Order header */}
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-900">{order.title}</h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {order.restaurant} &middot; Deadline {order.deadline} &middot;{" "}
                      <span className="font-medium text-slate-600">{order.bids} bid{order.bids !== 1 ? "s" : ""}</span>
                    </p>
                  </div>
                  <span className="badge shrink-0 bg-emerald-100 text-emerald-700">Open</span>
                </div>

                {/* Item tags */}
                <ul className="mb-4 flex flex-wrap gap-2">
                  {order.items.map((item) => (
                    <li key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {item}
                    </li>
                  ))}
                </ul>

                {/* Inline bid form */}
                <form className="flex gap-2 border-t border-slate-100 pt-4">
                  <input type="hidden" name="order_id" value={order.id} />
                  <input
                    type="number"
                    name="price"
                    min="0"
                    step="0.01"
                    required
                    placeholder="Your price ($)"
                    className="input flex-1"
                  />
                  <input
                    type="text"
                    name="notes"
                    placeholder="Notes (optional)"
                    className="input flex-1"
                  />
                  <button
                    type="submit"
                    className="btn-primary shrink-0 px-5"
                  >
                    Bid
                  </button>
                </form>
              </div>
            ))}
          </div>

          {/* ── My bids sidebar ── */}
          <div className="space-y-3">
            <h2 className="font-semibold text-slate-900">My Bids</h2>

            {myBids.map((bid) => {
              const s = bidStatusConfig[bid.status];
              return (
                <div key={bid.id} className="card p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-800 leading-snug">{bid.order_title}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-extrabold text-slate-900">${bid.price}</p>
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                  </div>
                </div>
              );
            })}

            {myBids.length === 0 && (
              <div className="card p-6 text-center">
                <p className="text-sm text-slate-400">No bids placed yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, color,
}: {
  icon: string;
  label: string;
  value: number;
  color: "indigo" | "amber" | "emerald";
}) {
  const accent = { indigo: "text-indigo-600", amber: "text-amber-600", emerald: "text-emerald-600" }[color];
  const bg     = { indigo: "bg-indigo-50",    amber: "bg-amber-50",    emerald: "bg-emerald-50"    }[color];

  return (
    <div className="card flex items-start gap-4 p-5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${bg}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className={`mt-0.5 text-2xl font-extrabold ${accent}`}>{value}</p>
      </div>
    </div>
  );
}
