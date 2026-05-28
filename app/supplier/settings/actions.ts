"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateSupplierProfile(
  formData: FormData
): Promise<{ error?: string }> {
  const postal_code  = ((formData.get("postal_code")  as string) ?? "").trim();
  const prefecture   = ((formData.get("prefecture")   as string) ?? "").trim();
  const city_ward    = ((formData.get("city_ward")    as string) ?? "").trim();
  const block_banchi = ((formData.get("block_banchi") as string) ?? "").trim();
  const latRaw       = formData.get("lat")  as string | null;
  const lngRaw       = formData.get("lng")  as string | null;
  const lat          = latRaw  ? parseFloat(latRaw)  : null;
  const lng          = lngRaw  ? parseFloat(lngRaw)  : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { error } = await supabase
    .from("supplier_profiles")
    .upsert(
      {
        id:            user.id,
        business_name: (user.user_metadata?.business_name as string) ?? null,
        postal_code:   postal_code  || null,
        prefecture:    prefecture   || null,
        city_ward:     city_ward    || null,
        block_banchi:  block_banchi || null,
        latitude:      lat ?? null,
        longitude:     lng ?? null,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) return { error: error.message };

  // Keep user_metadata in sync so proximity queries work without a DB round-trip
  await supabase.auth.updateUser({
    data: {
      postal_code, prefecture, city_ward, block_banchi,
      latitude:  lat ?? null,
      longitude: lng ?? null,
    },
  });

  revalidatePath("/supplier/settings");
  revalidatePath("/supplier/dashboard");
  return {};
}
