import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

type SupplierRow = {
  id: string;
  business_name: string | null;
  prefecture:    string | null;
  city_ward:     string | null;
  average_rating: number;
  total_ratings:  number;
};

export default async function SupplierDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ prefecture?: string; sort?: string }>;
}) {
  const { prefecture: prefFilter, sort } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (user.user_metadata?.role === "supplier") redirect("/supplier/dashboard");

  const restaurantPref =
    (user.user_metadata?.prefecture as string | undefined) ?? null;

  let query = supabase
    .from("supplier_profiles")
    .select("id, business_name, prefecture, city_ward, average_rating, total_ratings")
    .not("business_name", "is", null);

  if (prefFilter) {
    query = (query as typeof query).ilike("prefecture", `%${prefFilter}%`);
  }

  const { data: rawSuppliers } = await query.order("average_rating", {
    ascending: false,
  });

  const suppliers: SupplierRow[] = rawSuppliers ?? [];

  const sortedSuppliers =
    sort === "local" && restaurantPref
      ? [...suppliers].sort((a, b) => {
          const aLocal = a.prefecture === restaurantPref;
          const bLocal = b.prefecture === restaurantPref;
          if (aLocal && !bLocal) return -1;
          if (!aLocal && bLocal) return 1;
          return 0;
        })
      : suppliers;

  const buildHref = (params: Record<string, string>) => {
    const p = new URLSearchParams();
    if (prefFilter && !("prefecture" in params)) p.set("prefecture", prefFilter);
    if (sort       && !("sort"       in params)) p.set("sort",       sort);
    Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); });
    return `/supplier/directory${p.size > 0 ? `?${p}` : ""}`;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900">Supplier Directory</h1>
          <p className="mt-1 text-sm text-slate-500">
            Browse verified suppliers by location and rating.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <form method="GET" action="/supplier/directory" className="flex gap-2">
            {sort && <input type="hidden" name="sort" value={sort} />}
            <input
              name="prefecture"
              type="text"
              defaultValue={prefFilter ?? ""}
              placeholder="Filter by prefecture…"
              className="input w-48"
            />
            <button type="submit" className="btn-secondary py-2 px-3 text-sm">
              Search
            </button>
            {prefFilter && (
              <Link href={buildHref({ prefecture: "" })} className="btn-secondary py-2 px-3 text-sm">
                Clear
              </Link>
            )}
          </form>

          <div className="flex gap-2 ml-auto">
            <Link
              href={buildHref({ sort: "" })}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                !sort
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Top rated
            </Link>
            <Link
              href={buildHref({ sort: "local" })}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                sort === "local"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Same prefecture
            </Link>
          </div>
        </div>

        {/* Supplier cards */}
        {sortedSuppliers.length === 0 ? (
          <div className="card py-20 text-center">
            <p className="text-slate-400">
              {prefFilter
                ? `No suppliers found in "${prefFilter}".`
                : "No suppliers have set up their profile yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedSuppliers.map((supplier) => {
              const isLocal = restaurantPref !== null && supplier.prefecture === restaurantPref;

              return (
                <div
                  key={supplier.id}
                  className="card flex items-center justify-between gap-4 p-6 transition hover:shadow-card-hover"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900">{supplier.business_name}</h3>
                      {isLocal && (
                        <span className="badge bg-emerald-100 text-emerald-700">LOCAL</span>
                      )}
                    </div>
                    {supplier.prefecture && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        📍 {supplier.prefecture}{supplier.city_ward ? ` ${supplier.city_ward}` : ""}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    {supplier.total_ratings > 0 ? (
                      <>
                        <div className="flex items-center justify-end gap-1">
                          <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          <span className="font-bold text-amber-600">
                            {supplier.average_rating.toFixed(1)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {supplier.total_ratings} review{supplier.total_ratings !== 1 ? "s" : ""}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-slate-400">No ratings yet</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!restaurantPref && (
          <p className="mt-6 text-center text-xs text-slate-400">
            <Link href="/settings" className="text-indigo-600 hover:underline">
              Set your address in Settings
            </Link>{" "}
            to see which suppliers are in your prefecture.
          </p>
        )}
      </div>
    </div>
  );
}
