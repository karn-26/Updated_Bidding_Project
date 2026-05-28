"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { resolveCoords } from "@/lib/jp_postal";

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email         = formData.get("email")         as string;
  const password      = formData.get("password")      as string;
  const role          = formData.get("role")          as string;
  const business_name = formData.get("business_name") as string;
  const postal_code   = formData.get("postal_code")   as string | null;
  const prefecture    = formData.get("prefecture")    as string | null;
  const city_ward     = formData.get("city_ward")     as string | null;
  const block_banchi  = formData.get("block_banchi")  as string | null;

  // Resolve coordinates from postal code (offline lookup — no paid API)
  const coords = postal_code
    ? resolveCoords(postal_code, prefecture ?? undefined)
    : null;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        business_name,
        postal_code:   postal_code  ?? null,
        prefecture:    prefecture   ?? null,
        city_ward:     city_ward    ?? null,
        block_banchi:  block_banchi ?? null,
        latitude:      coords?.lat  ?? null,
        longitude:     coords?.lng  ?? null,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    return redirect(
      `/auth/signup?error=${encodeURIComponent(error.message)}`
    );
  }

  const admin = createAdminClient();

  // Seed role-specific profile row immediately so tables are populated
  // even before the user visits their settings page.
  if (data.user) {
    const profileBase = {
      business_name:  business_name || null,
      postal_code:    postal_code   ?? null,
      prefecture:     prefecture    ?? null,
      city_ward:      city_ward     ?? null,
      block_banchi:   block_banchi  ?? null,
      latitude:       coords?.lat   ?? null,
      longitude:      coords?.lng   ?? null,
    };

    if (role === "delivery_partner") {
      await admin.from("delivery_partners").upsert({
        id: data.user.id,
        ...profileBase,
        business_name: profileBase.business_name || "New Delivery Partner",
      });
    } else if (role === "supplier") {
      await admin.from("supplier_profiles").upsert({
        id: data.user.id,
        ...profileBase,
      });
    } else if (role === "restaurant_owner") {
      await admin.from("restaurant_profiles").upsert({
        id: data.user.id,
        ...profileBase,
      });
    }
  }

  // Email confirmation is disabled — redirect straight to the role dashboard.
  if (role === "supplier")          return redirect("/supplier/dashboard");
  if (role === "delivery_partner")  return redirect("/delivery/dashboard");
  return redirect("/dashboard");
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email    = formData.get("email")    as string;
  const password = formData.get("password") as string;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return redirect(
      `/auth/login?error=${encodeURIComponent(error.message)}`
    );
  }

  const role = data.user?.user_metadata?.role;
  if (role === "supplier")         redirect("/supplier/dashboard");
  else if (role === "delivery_partner") redirect("/delivery/dashboard");
  else redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
