import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const features = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
    title: "Post detailed orders",
    desc: "Specify every ingredient, quantity, unit, and delivery deadline in one structured form.",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Competitive bidding",
    desc: "Verified suppliers compete on price and terms — you always get market-best rates.",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "One-click accept",
    desc: "Compare bids side-by-side, accept with one click, and coordinate delivery in-platform.",
  },
];

const steps = [
  { n: "01", title: "Post an Order", desc: "List the supplies you need — items, quantities, and your deadline." },
  { n: "02", title: "Suppliers Bid", desc: "Verified suppliers review your order and submit their best price." },
  { n: "03", title: "Accept & Fulfil", desc: "Pick the best offer, confirm, and track delivery — all in one place." },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const role = user.user_metadata?.role as string | undefined;
    redirect(role === "supplier" ? "/supplier/dashboard" : "/dashboard");
  }

  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 px-4 py-28 text-white">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />

        <div className="relative mx-auto max-w-3xl text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Now open for restaurant owners &amp; suppliers
          </span>

          <h1 className="mt-4 text-5xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
            Source smarter.<br />
            <span className="text-indigo-200">Bid better.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-indigo-100/90">
            FoodSource connects restaurants with vetted suppliers through a transparent
            bidding marketplace — less phone-tag, better prices, every week.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/auth/signup" className="w-full sm:w-auto rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-indigo-700 shadow-lg transition hover:bg-indigo-50 hover:shadow-xl">
              Get started free
            </Link>
            <Link href="/auth/login" className="w-full sm:w-auto rounded-xl border border-white/30 bg-white/10 px-8 py-3.5 text-sm font-semibold backdrop-blur-sm transition hover:bg-white/20">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Role cards ── */}
      <section className="bg-slate-50 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-extrabold text-slate-900">Built for both sides of the table</h2>
            <p className="mt-3 text-slate-500">One platform, two powerful dashboards.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Restaurant owner */}
            <div className="card group flex flex-col gap-5 p-8 transition hover:shadow-card-hover">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-2xl">
                🍽️
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Restaurant Owners</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Post ingredient and supply orders in minutes. Receive competitive bids from
                  verified local suppliers and manage all procurement from one dashboard.
                </p>
              </div>
              <Link href="/auth/signup" className="btn-primary mt-auto self-start">
                Start posting orders
              </Link>
            </div>

            {/* Supplier */}
            <div className="card group flex flex-col gap-5 p-8 transition hover:shadow-card-hover">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-2xl">
                🚚
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Suppliers</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Browse live orders from restaurants near you, submit competitive bids, and
                  grow your customer base — no cold outreach required.
                </p>
              </div>
              <Link
                href="/auth/signup"
                className="mt-auto self-start rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Start bidding
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-white px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-extrabold text-slate-900">Everything you need to procure smarter</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {features.map(({ icon, title, desc }) => (
              <div key={title} className="flex flex-col gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  {icon}
                </div>
                <h3 className="font-bold text-slate-900">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="bg-slate-50 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-extrabold text-slate-900">How it works</h2>
            <p className="mt-3 text-slate-500">Up and running in under five minutes.</p>
          </div>
          <div className="relative grid gap-8 sm:grid-cols-3">
            {/* connector line (desktop) */}
            <div className="absolute left-0 right-0 top-5 hidden h-px bg-slate-200 sm:block" style={{ left: "10%", right: "10%" }} />

            {steps.map(({ n, title, desc }) => (
              <div key={n} className="relative flex flex-col items-center text-center gap-4">
                <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-indigo-600 bg-white text-sm font-bold text-indigo-600">
                  {n}
                </div>
                <h3 className="font-bold text-slate-900">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-indigo-600 px-4 py-20 text-center text-white">
        <h2 className="text-3xl font-extrabold">Ready to cut your food costs?</h2>
        <p className="mt-3 text-indigo-200">Join hundreds of restaurants and suppliers already on FoodSource.</p>
        <Link href="/auth/signup" className="mt-8 inline-block rounded-xl bg-white px-10 py-3.5 text-sm font-bold text-indigo-700 shadow-lg transition hover:bg-indigo-50">
          Create a free account
        </Link>
      </section>
    </div>
  );
}
