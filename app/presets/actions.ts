"use server";

// Required Supabase table — run this SQL in your project:
//
// create table order_presets (
//   id uuid primary key default gen_random_uuid(),
//   restaurant_id uuid references auth.users not null,
//   name text not null,
//   items jsonb not null default '[]',
//   created_at timestamptz default now()
// );
//
// -- RLS policies:
// alter table order_presets enable row level security;
// create policy "owners manage own presets" on order_presets
//   using (restaurant_id = auth.uid())
//   with check (restaurant_id = auth.uid());

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type PresetItem = { name: string; quantity: number; unit: string };

export async function createPreset(name: string, items: PresetItem[]) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("order_presets").insert({
    restaurant_id: user.id,
    name: name.trim(),
    items,
  });

  if (error) return { error: error.message };
  revalidatePath("/presets");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deletePreset(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("order_presets")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/presets");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function placeOrderFromPreset(presetId: string, deadline: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: preset } = await supabase
    .from("order_presets")
    .select("name, items")
    .eq("id", presetId)
    .eq("restaurant_id", user.id)
    .single();

  if (!preset) return { error: "Preset not found" };

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      restaurant_id: user.id,
      title: preset.name,
      deadline,
      status: "open",
    })
    .select()
    .single();

  if (orderErr) return { error: orderErr.message };

  const items = preset.items as PresetItem[];
  const { error: itemsErr } = await supabase.from("order_items").insert(
    items.map((i) => ({
      order_id: order.id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
    }))
  );

  if (itemsErr) return { error: itemsErr.message };

  try {
    const admin = createAdminClient();
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const suppliers = users.filter((u) => u.user_metadata?.role === "supplier");
    if (suppliers.length > 0) {
      await admin.from("notifications").insert(
        suppliers.map((s) => ({
          user_id: s.id,
          title: "New Order Available",
          message: `A new order "${preset.name}" has been posted. Be the first to bid!`,
          is_read: false,
          link: `/supplier/bids/new?order_id=${order.id}`,
        }))
      );
    }
  } catch (e) {
    console.error("[placeOrderFromPreset] notification error:", e);
  }

  revalidatePath("/dashboard");
  return { ok: true, orderId: order.id };
}
