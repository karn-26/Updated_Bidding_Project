import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import MyBidsPanel, { type SupplierBid } from "@/components/supplier/MyBidsPanel";
import LiveOrdersFeed from "@/components/supplier/LiveOrdersFeed";

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.user_metadata?.role === "restaurant_owner") redirect("/dashboard");
  if (user.user_metadata?.role === "delivery_partner") redirect("/delivery/dashboard");

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

  // Use admin client so orders join works for closed/in_delivery orders
  const admin = createAdminClient();
  const { data: myBidsData, error: bidsError } = await admin
    .from("bids")
    .select(`id, order_id, price, delivery_type, delivery_fee, delivery_fee_estimated, status, orders ( title )`)
    .eq("supplier_id", user.id)
    .order("created_at", { ascending: false });

  if (bidsError) console.error("Supabase error fetching supplier bids:", bidsError);

  // Fetch delivery status for won bids so MyBidsPanel can show it
  const wonBidIds = (myBidsData ?? [])
    .filter((b) => b.status === "won")
    .map((b) => b.id);

  type DeliveryDetail = {
    bid_id: string;
    id: string;
    status: string;
    delivery_method: string;
    partner_deadline: string | null;
    claimed_at: string | null;
    picked_up_at: string | null;
    delivered_at: string | null;
  };
  const deliveryDetailMap = new Map<string, DeliveryDetail>();
  if (wonBidIds.length > 0) {
    const { data: deliveries } = await admin
      .from("deliveries")
      .select("bid_id, id, status, delivery_method, partner_deadline, claimed_at, picked_up_at, delivered_at")
      .in("bid_id", wonBidIds);
    for (const d of (deliveries ?? []) as DeliveryDetail[]) {
      deliveryDetailMap.set(d.bid_id, d);
    }
  }

  // Fetch supplier's own profile
  const { data: supplierProfile } = await supabase
    .from("supplier_profiles")
    .select("city, country, average_rating, total_ratings")
    .eq("id", user.id)
    .maybeSingle();

  // Fetch recent ratings
  const { data: ratingsData } = await admin
    .from("supplier_ratings")
    .select("id, rating, review, restaurant_business_name, created_at")
    .eq("supplier_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const orders: Order[] = openOrders ?? [];
  const myBids: SupplierBid[] = (myBidsData ?? []).map((bid) => {
    const detail = deliveryDetailMap.get(bid.id);
    return {
      ...bid,
      orders: bid.orders === null
        ? null
        : Array.isArray(bid.orders)
        ? bid.orders as { title: string }[]
        : [bid.orders as { title: string }],
      delivery_type:          (bid.delivery_type  as "supplier" | "partner") ?? "supplier",
      delivery_fee:           (bid.delivery_fee   as number)  ?? 0,
      delivery_fee_estimated: (bid.delivery_fee_estimated as boolean) ?? false,
      deliveryStatus:         detail?.status          ?? null,
      deliveryId:             detail?.id              ?? null,
      deliveryMethod:         detail?.delivery_method ?? null,
      partnerDeadline:        detail?.partner_deadline ?? null,
      claimedAt:              detail?.claimed_at      ?? null,
      pickedUpAt:             detail?.picked_up_at    ?? null,
      deliveredAt:            detail?.delivered_at    ?? null,
    };
  });
  const biddedOrderIds = new Set(myBids.map((b) => b.order_id));

  type RatingRow = {
    id: string;
    rating: number;
    review: string | null;
    restaurant_business_name: string | null;
    created_at: string;
  };
  const ratings: RatingRow[] = ratingsData ?? [];

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
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <StatCard icon="📦" label="Open Orders Available" value={orders.length}                                     color="indigo"  />
          <StatCard icon="📝" label="Bids Placed"           value={myBids.length}                                     color="amber"   />
          <StatCard icon="🏆" label="Bids Accepted"         value={myBids.filter((b) => b.status === "won").length}  color="emerald" />
          <StatCard icon="⭐" label="Avg Rating"
            value={supplierProfile?.total_ratings ? supplierProfile.average_rating : 0}
            color="yellow"
            isRating
          />
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Open orders */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-semibold text-slate-900">Open Orders</h2>
            <LiveOrdersFeed
              initialOrders={orders}
              biddedOrderIds={[...biddedOrderIds]}
            />
          </div>

          {/* My bids sidebar */}
          <div className="space-y-3">
            <h2 className="font-semibold text-slate-900">My Bids</h2>
            <MyBidsPanel
              initialBids={myBids}
              userId={user.id}
            />
          </div>
        </div>

        {/* Ratings section */}
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Your Ratings</h2>
            <Link
              href="/supplier/settings"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Settings →
            </Link>
          </div>

          {ratings.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-slate-400">No ratings yet.</p>
              <p className="mt-1 text-sm text-slate-400">
                Complete fulfilled orders to receive ratings from restaurants.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card flex items-center gap-6 p-6">
                <div className="text-center">
                  <p className="text-5xl font-extrabold text-amber-500">
                    {supplierProfile?.average_rating?.toFixed(1) ?? "—"}
                  </p>
                  <div className="mt-1 flex justify-center gap-0.5">
                    {[1,2,3,4,5].map((s) => (
                      <svg
                        key={s}
                        className={`h-5 w-5 ${s <= Math.round(supplierProfile?.average_rating ?? 0) ? "text-amber-400" : "text-slate-200"}`}
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <div className="border-l border-slate-100 pl-6">
                  <p className="text-2xl font-bold text-slate-900">{supplierProfile?.total_ratings ?? 0}</p>
                  <p className="text-sm text-slate-500">review{(supplierProfile?.total_ratings ?? 0) !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {ratings.map((r) => (
                <div key={r.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {r.restaurant_business_name ?? "Anonymous restaurant"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {new Date(r.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      {[1,2,3,4,5].map((s) => (
                        <svg
                          key={s}
                          className={`h-4 w-4 ${s <= r.rating ? "text-amber-400" : "text-slate-200"}`}
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  {r.review && (
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">&ldquo;{r.review}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, color, isRating,
}: {
  icon: string;
  label: string;
  value: number;
  color: "indigo" | "amber" | "emerald" | "yellow";
  isRating?: boolean;
}) {
  const accent = { indigo: "text-indigo-600", amber: "text-amber-600", emerald: "text-emerald-600", yellow: "text-yellow-600" }[color];
  const bg     = { indigo: "bg-indigo-50",    amber: "bg-amber-50",    emerald: "bg-emerald-50",    yellow: "bg-yellow-50"    }[color];

  return (
    <div className="card flex items-start gap-4 p-5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${bg}`}>{icon}</div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className={`mt-0.5 text-2xl font-extrabold ${accent}`}>
          {isRating ? (value > 0 ? value.toFixed(1) : "—") : value}
        </p>
      </div>
    </div>
  );
}
