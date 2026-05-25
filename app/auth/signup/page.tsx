import { signUp } from "@/app/auth/actions";
import Link from "next/link";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Join FoodSource as a restaurant or supplier</p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form action={signUp} className="space-y-6">
            {/* Role picker */}
            <div>
              <label className="label">I am a&hellip;</label>
              <div className="grid grid-cols-2 gap-3">
                <RoleCard
                  value="restaurant"
                  emoji="🍽️"
                  title="Restaurant Owner"
                  desc="Post orders & accept bids"
                  defaultChecked
                  accent="indigo"
                />
                <RoleCard
                  value="supplier"
                  emoji="🚚"
                  title="Supplier"
                  desc="Browse orders & submit bids"
                  accent="emerald"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="business_name">Business name</label>
              <input
                id="business_name"
                name="business_name"
                type="text"
                required
                placeholder="e.g. The Golden Fork"
                className="input"
              />
            </div>

            <div>
              <label className="label" htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="input"
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                className="input"
              />
            </div>

            <button type="submit" className="btn-primary w-full py-3">
              Create account
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  value,
  emoji,
  title,
  desc,
  defaultChecked,
  accent,
}: {
  value: string;
  emoji: string;
  title: string;
  desc: string;
  defaultChecked?: boolean;
  accent: "indigo" | "emerald";
}) {
  const checked =
    accent === "indigo"
      ? "peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:ring-2 peer-checked:ring-indigo-200"
      : "peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:ring-2 peer-checked:ring-emerald-200";

  return (
    <label className="relative flex cursor-pointer flex-col">
      <input
        type="radio"
        name="role"
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <div
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-slate-200 bg-white p-4 text-center transition-all hover:border-slate-300 ${checked}`}
      >
        <span className="text-2xl">{emoji}</span>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-[11px] text-slate-400 leading-snug">{desc}</p>
      </div>
    </label>
  );
}
