"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email         = formData.get("email")         as string;
  const password      = formData.get("password")      as string;
  const role          = formData.get("role")          as string;
  const business_name = formData.get("business_name") as string;
  const city          = formData.get("city")          as string | null;
  const country       = formData.get("country")       as string | null;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, business_name, city: city ?? null, country: country ?? null },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    return redirect(
      `/auth/signup?error=${encodeURIComponent(error.message)}`
    );
  }

  // For delivery partners, seed their profile row immediately so the
  // delivery_partners table has a record even before they fill out settings.
  if (role === "delivery_partner" && data.user) {
    const admin = createAdminClient();
    await admin.from("delivery_partners").upsert({
      id: data.user.id,
      business_name: business_name || "New Delivery Partner",
      city: city ?? null,
      country: country ?? null,
    });
  }

  // Email confirmation is disabled — redirect straight to the role dashboard.
  if (role === "supplier") return redirect("/supplier/dashboard");
  if (role === "delivery_partner") return redirect("/delivery/dashboard");
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
  if (role === "supplier") redirect("/supplier/dashboard");
  else if (role === "delivery_partner") redirect("/delivery/dashboard");
  else redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
