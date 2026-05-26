"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateRestaurantProfile(formData: FormData) {
  const city    = ((formData.get("city")    as string) ?? "").trim();
  const country = ((formData.get("country") as string) ?? "").trim();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { error } = await supabase.auth.updateUser({
    data: {
      city:    city    || null,
      country: country || null,
    },
  });

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  revalidatePath("/bids");
  redirect("/settings?saved=1");
}
