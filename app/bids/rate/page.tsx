import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import StarRatingForm from "./StarRatingForm";

/**
 * CHANGE 6: All post-delivery ratings go through this page.
 * The restaurant rates the SUPPLIER regardless of delivery_type.
 * Guard: only allows rating when delivery.status = 'delivered'.
 */
export default async function RateBidPage({
  searchParams,
}: {
  searchParams: Promise<{
    supplierId?: string;
    orderId?: string;
    supplierName?: string;
  }>;
}) {
  const { supplierId, orderId, supplierName } = await searchParams;

  if (!supplierId || !orderId) redirect("/bids");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Verify the winning bid exists and belongs to an order owned by this restaurant
  const { data: bid } = await supabase
    .from("bids")
    .select("id")
    .eq("supplier_id", supplierId)
    .eq("order_id", orderId)
    .eq("status", "won")
    .single();

  if (!bid) redirect("/bids");

  // Guard: only allow rating when the delivery is completed
  const { data: delivery } = await supabase
    .from("deliveries")
    .select("id, status")
    .eq("order_id", orderId)
    .maybeSingle();

  if (!delivery || delivery.status !== "delivered") redirect("/bids");

  // Guard: don't show the form if this order was already rated
  const { data: existing } = await supabase
    .from("supplier_ratings")
    .select("id")
    .eq("order_id", orderId)
    .eq("restaurant_id", user.id)
    .maybeSingle();

  if (existing) redirect("/bids");

  const displayName = supplierName
    ? decodeURIComponent(supplierName)
    : "this supplier";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="card p-10 text-center">

          {/* Icon */}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-7 w-7 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900">
            Rate your supplier
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            How did{" "}
            <span className="font-semibold text-slate-700">{displayName}</span>{" "}
            do? Your rating helps other restaurants make better decisions.
          </p>

          <StarRatingForm supplierId={supplierId} orderId={orderId} />

          <Link
            href="/bids"
            className="mt-4 block text-sm font-medium text-slate-400 transition-colors hover:text-slate-700"
          >
            Skip for now
          </Link>
        </div>
      </div>
    </div>
  );
}
