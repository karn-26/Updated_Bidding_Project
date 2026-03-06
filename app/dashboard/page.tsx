import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const placeholderOrders = [
  { id: "ord_001", title: "Weekly produce order",    status: "open",      bids: 3, deadline: "2026-03-10" },
  { id: "ord_002", title: "Dry goods — pasta & rice", status: "open",      bids: 1, deadline: "2026-03-12" },
  { id: "ord_003", title: "Dairy & cheese bundle",    status: "fulfilled", bids: 5, deadline: "2026-03-05" },
];

const statusConfig: Record<string, { label: string; cls: string }> = {
  open:      { label: "Open",      cls: "bg-emerald-100 text-emerald-700" },
  fulfilled: { label: "Fulfilled", cls: "bg-slate-100 text-slate-600" },
  cancelled: { label: "Cancelled", cls: "bg-red-100 text-red-600" },
};

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.user_metadata?.role === "supplier") redirect("/supplier/dashboard");

  const businessName = user.user_metadata?.business_name ?? "there";

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
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon="📋" label="Open Orders"     value={2} trend="+1 this week" color="indigo" />
          <StatCard icon="💬" label="Pending Bids"    value={4} trend="2 need review" color="amber" />
          <StatCard icon="✅" label="Fulfilled Orders" value={1} trend="this month"   color="emerald" />
        </div>

        {/* Orders table */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="font-semibold text-slate-900">Your Orders</h2>
            <Link href="/bids" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline">
              View all bids →
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {placeholderOrders.map((order) => {
              const s = statusConfig[order.status];
              return (
                <div key={order.id} className="group flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{order.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Deadline {order.deadline} &middot;{" "}
                      <span className="font-medium text-slate-600">{order.bids} bid{order.bids !== 1 ? "s" : ""}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`badge ${s.cls}`}>{s.label}</span>
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

          {/* Empty state placeholder */}
          {placeholderOrders.length === 0 && (
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
  icon, label, value, trend, color,
}: {
  icon: string;
  label: string;
  value: number;
  trend: string;
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
        <p className="mt-0.5 text-[11px] text-slate-400">{trend}</p>
      </div>
    </div>
  );
}
