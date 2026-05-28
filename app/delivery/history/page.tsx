import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

type OrderRow    = { title: string } | { title: string }[] | null;
type RatingRow   = { delivery_id: string; rating: number; review: string | null };

function extractTitle(orders: OrderRow): string {
  if (!orders) return "—";
  return Array.isArray(orders)
    ? (orders as { title: string }[])[0]?.title ?? "—"
    : (orders as { title: string }).title ?? "—";
}

export default async function DeliveryHistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.user_metadata?.role !== "delivery_partner") redirect("/dashboard");

  // Fetch completed deliveries (RLS: delivery_partner_id = auth.uid())
  const { data: deliveriesData } = await supabase
    .from("deliveries")
    .select(`
      id, delivered_at, pickup_address, dropoff_address, delivery_fee,
      orders ( title )
    `)
    .eq("delivery_partner_id", user.id)
    .eq("status", "delivered")
    .order("delivered_at", { ascending: false })
    .limit(100);

  const deliveries = deliveriesData ?? [];

  // Fetch ratings this partner received, keyed by delivery_id
  const deliveryIds = deliveries.map((d) => d.id as string);
  const ratingMap = new Map<string, { rating: number; review: string | null }>();

  if (deliveryIds.length > 0) {
    const { data: ratingsData } = await supabase
      .from("delivery_ratings")
      .select("delivery_id, rating, review")
      .eq("delivery_partner_id", user.id)
      .in("delivery_id", deliveryIds);

    for (const r of (ratingsData ?? []) as RatingRow[]) {
      ratingMap.set(r.delivery_id, { rating: r.rating, review: r.review });
    }
  }

  const totalDeliveries = deliveries.length;
  const totalFees = deliveries.reduce((sum, d) => sum + ((d.delivery_fee as number) ?? 0), 0);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Link
                href="/delivery/dashboard"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Dashboard
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-sm font-medium text-slate-700">History</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Delivery History</h1>
            <p className="mt-1 text-sm text-slate-500">Your completed deliveries, most recent first.</p>
          </div>
        </div>

        {/* Stat cards */}
        {totalDeliveries > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard icon="✅" label="Total Completed" value={String(totalDeliveries)} />
            <StatCard icon="💴" label="Total Fees Earned" value={`¥${totalFees.toLocaleString()}`} />
            <StatCard
              icon="⭐"
              label="Deliveries Rated"
              value={`${ratingMap.size} / ${totalDeliveries}`}
            />
          </div>
        )}

        {/* History list */}
        {deliveries.length === 0 ? (
          <div className="card py-20 text-center">
            <p className="text-slate-400">No completed deliveries yet.</p>
            <p className="mt-1 text-sm text-slate-400">
              Completed deliveries will appear here once you mark them as delivered.
            </p>
            <Link href="/delivery/dashboard" className="btn-primary mx-auto mt-6 inline-flex">
              Find deliveries
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {deliveries.map((delivery) => {
              const orderTitle  = extractTitle(delivery.orders as OrderRow);
              const deliveryFee = (delivery.delivery_fee as number) ?? 0;
              const deliveredAt = delivery.delivered_at
                ? new Date(delivery.delivered_at as string).toLocaleDateString("ja-JP", {
                    year: "numeric", month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })
                : "—";
              const rating = ratingMap.get(delivery.id as string);

              return (
                <div key={delivery.id as string} className="card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 leading-snug">{orderTitle}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{deliveredAt}</p>

                      {/* Pickup / dropoff */}
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Pickup</p>
                          <p className="text-xs font-medium text-slate-700">
                            {(delivery.pickup_address as string | null) ?? "—"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Dropoff</p>
                          <p className="text-xs font-medium text-slate-700">
                            {(delivery.dropoff_address as string | null) ?? "—"}
                          </p>
                        </div>
                      </div>

                      {/* Rating received */}
                      {rating ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map((s) => (
                              <svg
                                key={s}
                                className={`h-3.5 w-3.5 ${s <= rating.rating ? "text-amber-400" : "text-slate-200"}`}
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            ))}
                          </div>
                          {rating.review && (
                            <p className="text-xs text-slate-500 italic">&ldquo;{rating.review}&rdquo;</p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-400">Not yet rated</p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-lg font-extrabold text-indigo-700">
                        ¥{deliveryFee.toLocaleString()}
                      </p>
                      <span className="badge bg-emerald-100 text-emerald-700 mt-1">Delivered</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="card flex items-start gap-4 p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl">
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 text-xl font-extrabold text-indigo-600">{value}</p>
      </div>
    </div>
  );
}
