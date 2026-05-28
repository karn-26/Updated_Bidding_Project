import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import DeliveryRatingForm from "./DeliveryRatingForm";

export default async function RateDeliveryPage({
  params,
  searchParams,
}: {
  params:       Promise<{ deliveryId: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { deliveryId } = await params;
  const { done }       = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // This page is for SUPPLIERS rating their DELIVERY PARTNER.
  // Restaurant owners rate the supplier via /bids/rate instead.
  if (user.user_metadata?.role !== "supplier") redirect("/dashboard");

  // Fetch the delivery — supplier must own this delivery
  const { data: delivery } = await supabase
    .from("deliveries")
    .select(`
      id, status, delivery_method, delivery_partner_id,
      delivery_partners ( business_name, average_rating, total_ratings ),
      orders ( title )
    `)
    .eq("id", deliveryId)
    .eq("supplier_id", user.id)
    .single();

  if (!delivery || delivery.status !== "delivered") notFound();

  // Guard: only partner deliveries have a partner to rate
  if ((delivery.delivery_method as string) !== "delivery_partner") {
    redirect("/supplier/dashboard");
  }

  // Check if already rated
  const { data: existingRating } = await supabase
    .from("delivery_ratings")
    .select("id")
    .eq("delivery_id", deliveryId)
    .eq("rated_by", user.id)
    .maybeSingle();

  const partner = Array.isArray(delivery.delivery_partners)
    ? delivery.delivery_partners[0] as { business_name: string; average_rating: number; total_ratings: number }
    : delivery.delivery_partners as { business_name: string; average_rating: number; total_ratings: number } | null;

  const orderTitle = Array.isArray(delivery.orders)
    ? (delivery.orders as { title: string }[])[0]?.title ?? "—"
    : (delivery.orders as { title: string } | null)?.title ?? "—";

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold text-slate-900">Rate Your Delivery</h1>
          <p className="mt-1 text-sm text-slate-500">
            Order: <span className="font-medium text-slate-700">{orderTitle}</span>
          </p>
          {partner && (
            <p className="mt-0.5 text-sm text-slate-500">
              Delivered by <span className="font-medium text-slate-700">{partner.business_name}</span>
            </p>
          )}
        </div>

        {done ? (
          <div className="card p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900">Rating submitted!</h2>
            <p className="mt-2 text-sm text-slate-500">Thank you for your feedback.</p>
          </div>
        ) : existingRating ? (
          <div className="card p-8 text-center">
            <p className="text-slate-500">You have already rated this delivery.</p>
          </div>
        ) : (
          <DeliveryRatingForm
            deliveryId={deliveryId}
            deliveryPartnerId={delivery.delivery_partner_id!}
            partnerName={partner?.business_name ?? "the delivery partner"}
          />
        )}
      </div>
    </div>
  );
}
