import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LiveDeliveriesFeed from "@/components/delivery/LiveDeliveriesFeed";
import ActiveDeliveryCard from "@/components/delivery/ActiveDeliveryCard";
import { haversineKm } from "@/lib/jp_postal";

export default async function DeliveryDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.user_metadata?.role !== "delivery_partner") redirect("/dashboard");

  const businessName = user.user_metadata?.business_name ?? "there";

  // Fetch delivery partner profile (includes lat/lng)
  const { data: profile } = await supabase
    .from("delivery_partners")
    .select("vehicle_type, is_available, average_rating, total_ratings, latitude, longitude, prefecture, city_ward")
    .eq("id", user.id)
    .maybeSingle();

  const partnerLat = profile?.latitude  as number | null | undefined ?? null;
  const partnerLng = profile?.longitude as number | null | undefined ?? null;

  // Active delivery (claimed or picked_up)
  const { data: activeDeliveryData } = await supabase
    .from("deliveries")
    .select(`
      id, status, pickup_address, dropoff_address, delivery_fee,
      claimed_at, picked_up_at, delivered_at, order_id,
      orders ( title, order_items ( name, quantity, unit ) )
    `)
    .eq("delivery_partner_id", user.id)
    .in("status", ["claimed", "picked_up"])
    .maybeSingle();

  // Completed deliveries this month for stats
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: completedData } = await supabase
    .from("deliveries")
    .select("id")
    .eq("delivery_partner_id", user.id)
    .eq("status", "delivered")
    .gte("delivered_at", startOfMonth.toISOString());

  // All pending unclaimed partner deliveries for the live feed
  const { data: pendingDeliveriesData } = await supabase
    .from("deliveries")
    .select(`
      id, status, pickup_address, dropoff_address, pickup_lat, pickup_lng,
      delivery_fee, created_at,
      orders ( id, title, order_items ( name, quantity, unit ) )
    `)
    .eq("status", "pending")
    .eq("delivery_method", "delivery_partner")
    .is("delivery_partner_id", null)
    .order("created_at", { ascending: false });

  const completedThisMonth = completedData?.length ?? 0;
  const avgRating          = profile?.average_rating ?? 0;
  const totalRatings       = profile?.total_ratings  ?? 0;

  type OrderItemRow = { name: string; quantity: number; unit: string };

  const activeDelivery = activeDeliveryData
    ? {
        id:              activeDeliveryData.id as string,
        status:          activeDeliveryData.status as "claimed" | "picked_up",
        pickup_address:  activeDeliveryData.pickup_address as string | null,
        dropoff_address: activeDeliveryData.dropoff_address as string | null,
        delivery_fee:    (activeDeliveryData.delivery_fee as number) ?? 0,
        claimed_at:      activeDeliveryData.claimed_at as string | null,
        picked_up_at:    activeDeliveryData.picked_up_at as string | null,
        order_id:        activeDeliveryData.order_id as string,
        orderTitle: Array.isArray(activeDeliveryData.orders)
          ? (activeDeliveryData.orders as { title: string }[])[0]?.title ?? "—"
          : (activeDeliveryData.orders as { title: string } | null)?.title ?? "—",
        orderItems: (Array.isArray(activeDeliveryData.orders)
          ? (activeDeliveryData.orders as { order_items: OrderItemRow[] }[])[0]?.order_items
          : (activeDeliveryData.orders as { order_items: OrderItemRow[] } | null)?.order_items
        ) ?? [],
      }
    : null;

  // ── Build pending deliveries with proximity data ───────────────────────────
  const NEAR_THRESHOLD_KM = 10; // "near you" badge threshold

  const pendingDeliveries = (pendingDeliveriesData ?? [])
    .map((d) => {
      const order = Array.isArray(d.orders)
        ? (d.orders as { id: string; title: string; order_items: OrderItemRow[] }[])[0]
        : d.orders as { id: string; title: string; order_items: OrderItemRow[] } | null;

      const pickupLat = d.pickup_lat as number | null | undefined ?? null;
      const pickupLng = d.pickup_lng as number | null | undefined ?? null;

      let distanceKm: number | null = null;
      if (partnerLat && partnerLng && pickupLat && pickupLng) {
        distanceKm = haversineKm(partnerLat, partnerLng, pickupLat, pickupLng);
      }

      const isNear = distanceKm !== null && distanceKm <= NEAR_THRESHOLD_KM;

      return {
        id:              d.id as string,
        status:          d.status as string,
        pickup_address:  d.pickup_address as string | null,
        dropoff_address: d.dropoff_address as string | null,
        delivery_fee:    (d.delivery_fee as number) ?? 0,
        created_at:      d.created_at as string,
        orderTitle:      order?.title ?? "—",
        orderItems:      order?.order_items ?? [],
        distanceKm,
        isNear,
      };
    })
    // Sort by distance ascending (null distances go last)
    .sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return 0;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });

  const pendingCount = pendingDeliveries.length;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Good morning, {businessName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {profile?.is_available
                ? "You are available for deliveries."
                : "You are currently unavailable — update in settings."}
            </p>
          </div>
          <Link href="/delivery/settings" className="btn-secondary self-start sm:self-auto">
            Settings
          </Link>
        </div>

        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard icon="📦" label="Available Now"       value={pendingCount}           color="indigo"  />
          <StatCard icon="🚚" label="Active Delivery"     value={activeDelivery ? 1 : 0} color="amber"   />
          <StatCard icon="✅" label="Completed This Month" value={completedThisMonth}     color="emerald" />
          <StatCard icon="⭐" label="Avg Rating" value={totalRatings > 0 ? avgRating : 0} color="yellow" isRating />
        </div>

        {/* Active delivery */}
        {activeDelivery && (
          <div className="mb-8">
            <h2 className="mb-3 font-semibold text-slate-900">Your Active Delivery</h2>
            <ActiveDeliveryCard delivery={activeDelivery} />
          </div>
        )}

        {/* Live feed of claimable deliveries */}
        <div>
          <h2 className="mb-3 font-semibold text-slate-900">
            Available Deliveries
            {pendingCount > 0 && (
              <span className="ml-2 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                {pendingCount}
              </span>
            )}
          </h2>
          {!partnerLat && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <span className="font-semibold">Add your address in settings</span> to see distance and get proximity-sorted jobs.
            </div>
          )}
          <LiveDeliveriesFeed
            initialDeliveries={pendingDeliveries}
            userId={user.id}
            hasActiveDelivery={!!activeDelivery}
          />
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
