import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-slate-800">FoodSource</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/auth/signup" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Sign up</Link>
            <Link href="/auth/login" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Sign in</Link>
          </div>
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} FoodSource. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
