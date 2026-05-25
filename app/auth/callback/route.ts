import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const role = data.user.user_metadata?.role;
      const dest = role === "supplier" ? "/supplier/dashboard" : "/dashboard";
      return NextResponse.redirect(new URL(dest, origin));
    }
  }

  return NextResponse.redirect(new URL("/auth/login?error=Could+not+confirm+email", origin));
}
