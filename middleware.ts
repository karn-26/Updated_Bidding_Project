import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — required for Server Components to stay in sync
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const role = user?.user_metadata?.role as string | undefined;

  // If logged in and on an auth page → redirect to their dashboard
  if (user && pathname.startsWith("/auth")) {
    let dest = "/dashboard";
    if (role === "supplier") dest = "/supplier/dashboard";
    else if (role === "delivery_partner") dest = "/delivery/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Protect all app routes — unauthenticated users go to login
  if (
    !user &&
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/orders") ||
      pathname.startsWith("/bids") ||
      pathname.startsWith("/supplier") ||
      pathname.startsWith("/delivery") ||
      pathname.startsWith("/presets") ||
      pathname.startsWith("/settings"))
  ) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Cross-role protection: supplier/delivery trying to access restaurant routes
  if (
    user &&
    (role === "supplier" || role === "delivery_partner") &&
    pathname.startsWith("/dashboard")
  ) {
    const dest = role === "supplier" ? "/supplier/dashboard" : "/delivery/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Cross-role protection: restaurant/delivery trying to access supplier routes
  if (
    user &&
    role !== "supplier" &&
    pathname.startsWith("/supplier")
  ) {
    const dest = role === "delivery_partner" ? "/delivery/dashboard" : "/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Cross-role protection: restaurant/supplier trying to access delivery routes
  if (
    user &&
    role !== "delivery_partner" &&
    pathname.startsWith("/delivery")
  ) {
    const dest = role === "supplier" ? "/supplier/dashboard" : "/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/orders/:path*",
    "/bids/:path*",
    "/supplier/:path*",
    "/delivery/:path*",
    "/presets/:path*",
    "/settings/:path*",
    "/auth/:path*",
  ],
};
