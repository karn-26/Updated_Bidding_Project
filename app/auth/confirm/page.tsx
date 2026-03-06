import Link from "next/link";

export default function ConfirmPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="card px-10 py-14">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl">
            ✉️
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Check your inbox</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            We&apos;ve sent a confirmation link to your email. Click it to activate your account
            and you&apos;ll be redirected to your dashboard automatically.
          </p>
          <Link
            href="/auth/login"
            className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
