"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateSupplierProfile(formData: FormData) {
  const city    = ((formData.get("city")    as string) ?? "").trim();
  const country = ((formData.get("country") as string) ?? "").trim();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const businessName = (user.user_metadata?.business_name as string) ?? null;

  const { error } = await supabase
    .from("supplier_profiles")
    .upsert(
      {
        id:           user.id,
        business_name: businessName,
        city:         city    || null,
        country:      country || null,
        updated_at:   new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    redirect(`/supplier/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/supplier/settings");
  revalidatePath("/supplier/dashboard");
  redirect("/supplier/settings?saved=1");
}
