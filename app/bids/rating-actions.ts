"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function submitRating(formData: FormData) {
  const supplierId = formData.get("supplier_id") as string;
  const orderId    = formData.get("order_id")    as string;
  const rating     = parseInt(formData.get("rating") as string, 10);
  const review     = ((formData.get("review") as string) ?? "").trim() || null;

  if (!supplierId || !orderId || !rating || rating < 1 || rating > 5) {
    redirect("/bids");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const restaurantBusinessName =
    (user.user_metadata?.business_name as string) ?? null;

  const { error: insertError } = await supabase
    .from("supplier_ratings")
    .insert({
      supplier_id:              supplierId,
      restaurant_id:            user.id,
      order_id:                 orderId,
      restaurant_business_name: restaurantBusinessName,
      rating,
      review,
    });

  if (insertError) {
    console.error("[submitRating] insert error:", insertError);
    redirect("/bids");
  }

  // Recalculate aggregate rating via admin client (cross-user write to supplier_profiles)
  const admin = createAdminClient();
  const { data: allRatings } = await admin
    .from("supplier_ratings")
    .select("rating")
    .eq("supplier_id", supplierId);

  if (allRatings && allRatings.length > 0) {
    const avg =
      allRatings.reduce(
        (sum: number, r: { rating: number }) => sum + r.rating,
        0
      ) / allRatings.length;

    await admin.from("supplier_profiles").upsert(
      {
        id:             supplierId,
        average_rating: Math.round(avg * 100) / 100,
        total_ratings:  allRatings.length,
        updated_at:     new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  }

  revalidatePath("/bids");
  revalidatePath("/supplier/dashboard");
  redirect("/bids?rated=1");
}
