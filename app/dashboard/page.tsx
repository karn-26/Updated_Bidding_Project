import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import QuickOrderButton from "@/components/presets/QuickOrderButton";

const statusConfig: Record<string, { label: string; cls: string }> = {
  open:        { label: "Open",        cls: "bg-emerald-100 text-emerald-700" },
  closed:      { label: "Closed",      cls: "bg-slate-100 text-slate-600"    },
  cancelled:   { label: "Cancelled",   cls: "bg-red-100 text-red-600"        },
  in_delivery: { label: "In Delivery", cls: "bg-indigo-100 text-indigo-700"  },
  fulfilled:   { label: "Fulfilled",   cls: "bg-emerald-100 text-emerald-700"},
};

const deliveryStatusConfig: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Awaiting pickup",  cls: "bg-amber-100 text-amber-700"    },
  claimed:   { label: "Partner claimed",  cls: "bg-indigo-100 text-indigo-700"  },
  picked_up: { label: "En route",         cls: "bg-blue-100 text-blue-700"      },
  delivered: { label: "Delivered",        cls: "bg-emerald-100 text-emerald-700"},
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.user_metadata?.role === "supplier") redirect("/supplier/dashboard");
  if (user.user_metadata?.role === "delivery_partner") redirect("/delivery/dashboard");

  const businessName = user.user_metadata?.business_name ?? "there";

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(`id, title, status, deadline, bids ( id, status )`)
    .eq("restaurant_id", user.id)
    .order("created_at", { ascending: false });

  if (ordersError) console.error("Supabase error fetching orders:", ordersError);

  const { data: presets } = await supabase
    .from("order_presets")
    .select("id, name, items")
    .eq("restaurant_id", user.id)
    .order("created_at", { ascending: false })
    .limit(4);

  // Active deliveries for this restaurant
  const { data: activeDeliveriesData } = await supabase
    .from("deliveries")
    .select(`
      id, status, order_id,
      orders ( title ),
      delivery_partners ( business_name, average_rating )
    `)
    .eq("restaurant_id", user.id)
    .in("status", ["pending", "claimed", "picked_up"])
    .order("created_at", { ascending: false });

  const rows           = orders ?? [];
  const openCount      = rows.filter((o) => o.status === "open").length;
  const inDelivery     = rows.filter((o) => o.status === "in_delivery").length;
  const fulfilledCount = rows.filter((o) => o.status === "fulfilled").length;
  const pendingBids    = rows.flatMap((o) => o.bids).filter((b) => b.status === "pending").length;

  const activeDeliveries = (activeDeliveriesData ?? []).map((d) => {
    const orderArr = Array.isArray(d.orders)
      ? d.orders as { title: string }[]
      : d.orders ? [d.orders as { title: string }] : [];
    const partnerArr = Array.isArray(d.delivery_partners)
      ? d.delivery_partners as { business_name: string; average_rating: number }[]
      : d.delivery_partners ? [d.delivery_partners as { business_name: string; average_rating: number }] : [];
    return {
      id:           d.id as string,
      status:       d.status as string,
      order_id:     d.order_id as string,
      orderTitle:   orderArr[0]?.title ?? "—",
      partnerName:  partnerArr[0]?.business_name ?? null,
      partnerRating: partnerArr[0]?.average_rating ?? 0,
    };
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">

        {/* Page header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Good morning, {businessName} 👋
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage your procurement orders and review incoming bids.
            </p>
          </div>
          <Link href="/orders/new" className="btn-primary self-start sm:self-auto">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Order
          </Link>
        </div>

        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard icon="📋" label="Open Orders"      value={openCount}      color="indigo"  />
          <StatCard icon="💬" label="Pending Bids"     value={pendingBids}    color="amber"   />
          <StatCard icon="🚚" label="In Delivery"      value={inDelivery}     color="blue"    />
          <StatCard icon="✅" label="Fulfilled Orders"  value={fulfilledCount} color="emerald" />
        </div>

        {/* Quick Reorder */}
        {presets && presets.length > 0 && (
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Quick Reorder</h2>
              <Link href="/presets" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline">
                Manage presets →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {presets.map((preset) => (
                <div key={preset.id} className="card flex flex-col gap-3 p-4">
                  <div>
                    <p className="truncate font-semibold text-slate-900">{preset.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {(preset.items as { name: string }[]).length} item{(preset.items as { name: string }[]).length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <QuickOrderButton presetId={preset.id} presetName={preset.name} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active deliveries */}
        {activeDeliveries.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 font-semibold text-slate-900">Active Deliveries</h2>
            <div className="space-y-3">
              {activeDeliveries.map((d) => {
                const ds = deliveryStatusConfig[d.status] ?? deliveryStatusConfig.pending;
                return (
                  <div key={d.id} className="card flex items-center justify-between gap-4 px-6 py-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{d.orderTitle}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {d.partnerName
                          ? <>Partner: <span className="font-medium text-slate-600">{d.partnerName}</span>{d.partnerRating > 0 && <span className="ml-1 text-amber-500">★ {d.partnerRating.toFixed(1)}</span>}</>
                          : "Awaiting a delivery partner"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className={`badge ${ds.cls}`}>{ds.label}</span>
                      <Link
                        href={`/orders/${d.order_id}`}
                        className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline sm:block"
                      >
                        View order
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Orders table */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="font-semibold text-slate-900">Your Orders</h2>
            <Link href="/bids" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline">
              View all bids →
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {rows.map((order) => {
              const s        = statusConfig[order.status] ?? statusConfig.open;
              const bidCount = order.bids.length;
              return (
                <div key={order.id} className="group flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{order.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Deadline {order.deadline} &middot;{" "}
                      <span className="font-medium text-slate-600">{bidCount} bid{bidCount !== 1 ? "s" : ""}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                    <Link
                      href={`/orders/${order.id}`}
                      className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline sm:block"
                    >
                      View details
                    </Link>
                    <Link
                      href={`/bids?order=${order.id}`}
                      className="hidden text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline sm:block"
                    >
                      View bids
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {rows.length === 0 && (
            <div className="px-6 py-16 text-center">
              <p className="text-slate-400">No orders yet.</p>
              <Link href="/orders/new" className="btn-primary mt-4 inline-flex">Post your first order</Link>
            </div>
          )}
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
  color: "indigo" | "amber" | "emerald" | "blue";
}) {
  const accent = { indigo: "text-indigo-600", amber: "text-amber-600", emerald: "text-emerald-600", blue: "text-blue-600" }[color];
  const bg     = { indigo: "bg-indigo-50",    amber: "bg-amber-50",    emerald: "bg-emerald-50",    blue: "bg-blue-50"    }[color];

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
