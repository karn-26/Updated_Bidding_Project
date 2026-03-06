import Link from "next/link";
import SignOutButton from "./SignOutButton";
import type { User } from "@supabase/supabase-js";

interface NavbarProps {
  user: User | null;
}

export default function Navbar({ user }: NavbarProps) {
  const role = user?.user_metadata?.role as string | undefined;
  const businessName = user?.user_metadata?.business_name as string | undefined;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-base font-bold text-slate-900 tracking-tight">FoodSource</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {user ? (
            role === "restaurant_owner" ? (
              <>
                <NavLink href="/dashboard">Dashboard</NavLink>
                <NavLink href="/orders/new">Place Order</NavLink>
                <NavLink href="/bids">My Bids</NavLink>
              </>
            ) : (
              <NavLink href="/supplier/dashboard">Dashboard</NavLink>
            )
          ) : (
            <>
              <NavLink href="/#how-it-works">How it works</NavLink>
              <NavLink href="/auth/signup">Sign up</NavLink>
            </>
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 pl-3 pr-1 py-1">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-slate-600 max-w-[140px] truncate">
                  {businessName ?? user.email}
                </span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                  {role === "supplier" ? "Supplier" : "Owner"}
                </span>
              </div>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Sign in
              </Link>
              <Link href="/auth/signup" className="btn-primary text-sm px-4 py-2">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </Link>
  );
}
