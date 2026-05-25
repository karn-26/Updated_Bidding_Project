"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as string;
  const business_name = formData.get("business_name") as string;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, business_name },
      // Make sure this matches the redirect URL configured in your Supabase project:
      // Authentication → URL Configuration → Redirect URLs → http://localhost:3000/auth/callback
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    return redirect(
      `/auth/signup?error=${encodeURIComponent(error.message)}`
    );
  }

  // Email confirmation enabled: tell user to check their inbox
  return redirect("/auth/confirm");
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
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
  redirect(role === "supplier" ? "/supplier/dashboard" : "/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
