import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DeliverySettingsForm from "./DeliverySettingsForm";

export default async function DeliverySettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.user_metadata?.role !== "delivery_partner") redirect("/dashboard");

  const { data: profile } = await supabase
    .from("delivery_partners")
    .select("business_name, postal_code, prefecture, city_ward, block_banchi, phone, vehicle_type, is_available")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900">Delivery Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Update your profile and availability.
          </p>
        </div>
        <DeliverySettingsForm
          initialValues={{
            business_name: profile?.business_name ?? "",
            postal_code:   profile?.postal_code   ?? "",
            prefecture:    profile?.prefecture    ?? "",
            city_ward:     profile?.city_ward     ?? "",
            block_banchi:  profile?.block_banchi  ?? "",
            phone:         profile?.phone         ?? "",
            vehicle_type:  (profile?.vehicle_type ?? "") as "bike" | "car" | "van" | "truck" | "",
            is_available:  profile?.is_available  ?? true,
          }}
        />
      </div>
    </div>
  );
}
