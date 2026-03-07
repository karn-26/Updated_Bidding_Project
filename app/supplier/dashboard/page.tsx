import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import MyBidsPanel, { type SupplierBid } from "@/components/supplier/MyBidsPanel";

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
};

type Order = {
  id: string;
  title: string;
  deadline: string;
  restaurant_id: string;
  order_items: OrderItem[];
};

export default async function SupplierDashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.user_metadata?.role === "restaurant") redirect("/dashboard");

  const businessName = user.user_metadata?.business_name ?? "there";

  const { data: openOrders, error: ordersError } = await supabase
    .from("orders")
    .select(`
      id,
      title,
      deadline,
      restaurant_id,
      order_items (
        id,
        name,
        quantity,
        unit
      )
    `)
    .eq("status", "open")
    .order("deadline", { ascending: true });

  if (ordersError) console.error("Supabase error fetching open orders:", ordersError);

  // Use admin client so the orders join works regardless of order status.
  // The supplier RLS policy only allows reading open orders, which means
  // orders that have been closed (after a bid is accepted) return null
  // for the join, causing the order title to show as "—".
  const admin = createAdminClient();
  const { data: myBidsData, error: bidsError } = await admin
    .from("bids")
    .select(`id, order_id, price, status, orders ( title )`)
    .eq("supplier_id", user.id)
    .order("created_at", { ascending: false });

  if (bidsError) console.error("Supabase error fetching supplier bids:", bidsError);

  const orders: Order[] = openOrders ?? [];
  const myBids: SupplierBid[] = (myBidsData ?? []).map((bid) => ({
    ...bid,
    orders: bid.orders ? [bid.orders as { title: string }] : null,
  }));
  const biddedOrderIds = new Set(myBids.map((b) => b.order_id));

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
          <StatCard icon="📦" label="Open Orders Available" value={orders.length}                                               color="indigo"  />
          <StatCard icon="📝" label="Bids Placed"           value={myBids.length}                                               color="amber"   />
          <StatCard icon="🏆" label="Bids Accepted"         value={myBids.filter((b) => b.status === "won").length}           color="emerald" />
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* ── Open orders (main column) ── */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-semibold text-slate-900">Open Orders</h2>

            {orders.length === 0 && (
              <div className="card p-10 text-center">
                <p className="text-slate-400">No open orders at the moment. Check back soon.</p>
              </div>
            )}

            {orders.map((order) => (
              <div key={order.id} className="card p-6 transition hover:shadow-card-hover">
                {/* Order header */}
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-900">{order.title}</h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Deadline{" "}
                      <span className="font-medium text-slate-600">{order.deadline}</span>
                      {" "}&middot;{" "}
                      {order.order_items.length} item{order.order_items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="badge shrink-0 bg-emerald-100 text-emerald-700">Open</span>
                </div>

                {/* Item tags */}
                {order.order_items.length > 0 && (
                  <ul className="mb-4 flex flex-wrap gap-2">
                    {order.order_items.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                      >
                        {item.quantity} {item.unit} {item.name}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Place a bid / already bid */}
                <div className="border-t border-slate-100 pt-4">
                  {biddedOrderIds.has(order.id) ? (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Bid Submitted
                    </span>
                  ) : (
                    <Link
                      href={`/supplier/bids/new?order_id=${order.id}`}
                      className="btn-primary inline-flex px-6"
                    >
                      Place a Bid
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── My bids sidebar ── */}
          <div className="space-y-3">
            <h2 className="font-semibold text-slate-900">My Bids</h2>
            <MyBidsPanel
              initialBids={myBids}
              userId={user.id}
            />
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
