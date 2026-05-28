import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import RestaurantSettingsForm from "./RestaurantSettingsForm";

export default async function RestaurantSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.user_metadata?.role === "supplier") redirect("/supplier/settings");

  const { data: profile } = await supabase
    .from("restaurant_profiles")
    .select("postal_code, prefecture, city_ward, block_banchi")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">

        <div className="mb-8 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Dashboard
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-medium text-slate-700">Settings</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your restaurant profile.</p>
        </div>

        <div className="card p-8">
          <h2 className="font-semibold text-slate-900 mb-1">Business Address</h2>
          <p className="text-sm text-slate-500 mb-6">
            Your address is used to calculate delivery fees and highlight nearby
            suppliers in your bids inbox.
          </p>
          <RestaurantSettingsForm
            initialAddress={{
              postal_code:  profile?.postal_code  ?? "",
              prefecture:   profile?.prefecture   ?? "",
              city_ward:    profile?.city_ward    ?? "",
              block_banchi: profile?.block_banchi ?? "",
            }}
          />
        </div>

      </div>
    </div>
  );
}
