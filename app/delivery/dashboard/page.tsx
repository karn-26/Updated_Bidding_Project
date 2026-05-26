import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LiveDeliveriesFeed from "@/components/delivery/LiveDeliveriesFeed";
import ActiveDeliveryCard from "@/components/delivery/ActiveDeliveryCard";

export default async function DeliveryDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.user_metadata?.role !== "delivery_partner") redirect("/dashboard");

  const businessName = user.user_metadata?.business_name ?? "there";

  // Fetch delivery partner profile
  const { data: profile } = await supabase
    .from("delivery_partners")
    .select("city, country, vehicle_type, is_available, average_rating, total_ratings")
    .eq("id", user.id)
    .maybeSingle();

  // Active delivery (claimed or picked_up)
  const { data: activeDeliveryData } = await supabase
    .from("deliveries")
    .select(`
      id, status, pickup_address, dropoff_address,
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

  // All pending unclaimed deliveries for the live feed — supplier-handled excluded
  const { data: pendingDeliveriesData } = await supabase
    .from("deliveries")
    .select(`
      id, status, pickup_address, dropoff_address, created_at,
      orders ( id, title, order_items ( name, quantity, unit ) )
    `)
    .eq("status", "pending")
    .eq("delivery_method", "delivery_partner")
    .is("delivery_partner_id", null)
    .order("created_at", { ascending: false });

  const completedThisMonth = completedData?.length ?? 0;
  const pendingCount       = pendingDeliveriesData?.length ?? 0;
  const avgRating          = profile?.average_rating ?? 0;
  const totalRatings       = profile?.total_ratings  ?? 0;

  // Normalise active delivery shape for client component
  type OrderItemRow = { name: string; quantity: number; unit: string };

  const activeDelivery = activeDeliveryData
    ? {
        id:              activeDeliveryData.id as string,
        status:          activeDeliveryData.status as "claimed" | "picked_up",
        pickup_address:  activeDeliveryData.pickup_address as string | null,
        dropoff_address: activeDeliveryData.dropoff_address as string | null,
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

  // Normalise pending deliveries for LiveDeliveriesFeed
  const pendingDeliveries = (pendingDeliveriesData ?? []).map((d) => {
    const order = Array.isArray(d.orders)
      ? (d.orders as { id: string; title: string; order_items: OrderItemRow[] }[])[0]
      : d.orders as { id: string; title: string; order_items: OrderItemRow[] } | null;
    return {
      id:              d.id as string,
      status:          d.status as string,
      pickup_address:  d.pickup_address as string | null,
      dropoff_address: d.dropoff_address as string | null,
      created_at:      d.created_at as string,
      orderTitle:      order?.title ?? "—",
      orderItems:      order?.order_items ?? [],
    };
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Good morning, {businessName} 👋
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
          <StatCard icon="📦" label="Available Now"       value={pendingCount}        color="indigo"  />
          <StatCard icon="🚚" label="Active Delivery"     value={activeDelivery ? 1 : 0} color="amber" />
          <StatCard icon="✅" label="Completed This Month" value={completedThisMonth}  color="emerald" />
          <StatCard
            icon="⭐"
            label="Avg Rating"
            value={totalRatings > 0 ? avgRating : 0}
            color="yellow"
            isRating
          />
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
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${bg}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className={`mt-0.5 text-2xl font-extrabold ${accent}`}>
          {isRating ? (value > 0 ? value.toFixed(1) : "—") : value}
        </p>
      </div>
    </div>
  );
}
