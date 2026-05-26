import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { updateRestaurantProfile } from "./actions";

export default async function RestaurantSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.user_metadata?.role === "supplier") redirect("/supplier/settings");

  const city    = (user.user_metadata?.city    as string) ?? "";
  const country = (user.user_metadata?.country as string) ?? "";

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
          <p className="mt-1 text-sm text-slate-500">
            Manage your restaurant profile.
          </p>
        </div>

        {saved && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            Settings saved successfully.
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        <div className="card p-8">
          <h2 className="font-semibold text-slate-900 mb-1">Your Location</h2>
          <p className="text-sm text-slate-500 mb-6">
            Set your city so bids from local suppliers are highlighted in your bids inbox.
          </p>

          <form action={updateRestaurantProfile} className="space-y-5">
            <div>
              <label className="label" htmlFor="city">City</label>
              <input
                id="city"
                name="city"
                type="text"
                defaultValue={city}
                placeholder="e.g. Tokyo"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="country">Country</label>
              <input
                id="country"
                name="country"
                type="text"
                defaultValue={country}
                placeholder="e.g. Japan"
                className="input"
              />
            </div>
            <button type="submit" className="btn-primary">
              Save Settings
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
