"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateBid(
  bidId: string,
  data: { price: number; delivery_date: string; notes: string }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("bids")
    .update({ price: data.price, delivery_date: data.delivery_date, notes: data.notes })
    .eq("id", bidId)
    .eq("supplier_id", user.id)
    .eq("status", "pending"); // only allow editing pending bids

  if (error) return { error: error.message };

  revalidatePath(`/supplier/bids/${bidId}`);
  revalidatePath("/supplier/dashboard");
  return { ok: true };
}
