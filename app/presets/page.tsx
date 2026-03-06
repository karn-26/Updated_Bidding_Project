import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PresetsClient from "@/components/presets/PresetsClient";

export type Preset = {
  id: string;
  name: string;
  items: { name: string; quantity: number; unit: string }[];
  created_at: string;
};

export default async function PresetsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.user_metadata?.role === "supplier") redirect("/supplier/dashboard");

  const { data: presets } = await supabase
    .from("order_presets")
    .select("id, name, items, created_at")
    .eq("restaurant_id", user.id)
    .order("created_at", { ascending: false });

  return <PresetsClient presets={(presets ?? []) as Preset[]} />;
}
