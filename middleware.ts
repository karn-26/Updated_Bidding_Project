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
    const dest = role === "supplier" ? "/supplier/dashboard" : "/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Protect restaurant-owner routes
  if (
    !user &&
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/orders") ||
      pathname.startsWith("/bids") ||
      pathname.startsWith("/supplier"))
  ) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Cross-role protection: supplier trying to access owner routes → redirect
  if (user && role === "supplier" && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/supplier/dashboard", request.url));
  }

  // Cross-role protection: owner trying to access supplier routes → redirect
  if (user && role === "restaurant_owner" && pathname.startsWith("/supplier")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/orders/:path*",
    "/bids/:path*",
    "/supplier/:path*",
    "/auth/:path*",
  ],
};
