"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
};

type Order = {
  id: string;
  title: string;
  deadline: string;
  restaurant_id: string;
  order_items: OrderItem[];
};

type Suggestion = {
  suggestedPrice: number;
  reasoning: string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewBidPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");

  // ── Order data ────────────────────────────────────────────────────────────
  const [order, setOrder] = useState<Order | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Form fields ───────────────────────────────────────────────────────────
  const [price, setPrice] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── AI suggestion ─────────────────────────────────────────────────────────
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // ─── Fetch order on mount ──────────────────────────────────────────────────

  useEffect(() => {
    if (!orderId) return;

    const supabase = createClient();
    supabase
      .from("orders")
      .select(`id, title, deadline, restaurant_id, order_items ( id, name, quantity, unit )`)
      .eq("id", orderId)
      .eq("status", "open")
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error("Error fetching order:", error);
          setLoadError("Order not found or no longer open.");
        } else {
          setOrder(data as Order);
        }
      });
  }, [orderId]);

  // ─── AI suggest ────────────────────────────────────────────────────────────

  const handleSuggest = async () => {
    if (!order) return;
    setIsSuggesting(true);
    setSuggestError(null);
    setSuggestion(null);

    try {
      const res = await fetch("/api/suggest-bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Suggestion failed");
      setSuggestion(data);
      setPrice(String(data.suggestedPrice));
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Suggestion failed");
    } finally {
      setIsSuggesting(false);
    }
  };

  // ─── Submit bid ────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    if (!price || !deliveryDate) return;

    setIsSaving(true);
    setSaveError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/auth/login");
      return;
    }

    const supplierName =
      user.user_metadata?.business_name ?? user.email ?? "Unknown Supplier";

    const { error } = await supabase.from("bids").insert({
      order_id: orderId,
      supplier_id: user.id,
      supplier_name: supplierName,
      price: parseFloat(price),
      delivery_date: deliveryDate,
      notes: notes.trim() || null,
      status: "pending",
    });

    if (error) {
      console.error("Supabase error submitting bid:", error);
      setSaveError(error.message);
      setIsSaving(false);
    } else {
      // Notify restaurant owner about the new bid (fire-and-forget)
      fetch("/api/notify-new-bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, supplierName }),
      }).catch((e) => console.error("notify-new-bid failed:", e));

      router.push("/supplier/dashboard?bid=submitted");
    }
  };

  // ─── Guard: no order_id in URL ─────────────────────────────────────────────

  if (!orderId) {
    return (
      <Shell>
        <div className="py-20 text-center">
          <p className="text-slate-500">No order specified.</p>
          <Link href="/supplier/dashboard" className="btn-primary mt-6 inline-flex">
            Back to Dashboard
          </Link>
        </div>
      </Shell>
    );
  }

  // ─── Guard: load error ─────────────────────────────────────────────────────

  if (loadError) {
    return (
      <Shell>
        <div className="py-20 text-center">
          <p className="text-red-500">{loadError}</p>
          <Link href="/supplier/dashboard" className="btn-primary mt-6 inline-flex">
            Back to Dashboard
          </Link>
        </div>
      </Shell>
    );
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (!order) {
    return (
      <Shell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner className="h-8 w-8 text-indigo-500" />
        </div>
      </Shell>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  // ─── Main render ───────────────────────────────────────────────────────────

  return (
    <Shell>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/supplier/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeftIcon />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900">Place a Bid</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review the order and submit your offer.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* ── Order details ── */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="font-bold text-slate-900 leading-snug">{order.title}</h2>
              <span className="badge shrink-0 bg-emerald-100 text-emerald-700">Open</span>
            </div>

            <dl className="mb-5 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Bid deadline</dt>
                <dd className="font-semibold text-slate-800">{order.deadline}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">Items requested</dt>
                <dd className="font-semibold text-slate-800">{order.order_items.length}</dd>
              </div>
            </dl>

            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Items
              </p>
              <ul className="space-y-2.5">
                {order.order_items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-800">{item.name}</span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {item.quantity} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ── Bid form ── */}
        <div className="lg:col-span-3 space-y-5">
          {/* AI suggestion card */}
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-900">AI Bid Suggestion</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Let Claude analyse the order and recommend a competitive price.
                </p>
              </div>
              <button
                onClick={handleSuggest}
                disabled={isSuggesting}
                className="btn-primary shrink-0 px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSuggesting ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    Analysing…
                  </>
                ) : (
                  <>
                    <SparkleIcon />
                    Suggest Bid
                  </>
                )}
              </button>
            </div>

            {suggestError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
                {suggestError}
              </div>
            )}

            {suggestion && (
              <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="text-xl font-extrabold text-indigo-700">
                    ${suggestion.suggestedPrice.toLocaleString()}
                  </span>
                  <span className="badge bg-indigo-100 text-indigo-700">Suggested</span>
                  <button
                    onClick={() => setPrice(String(suggestion.suggestedPrice))}
                    className="ml-auto text-xs font-semibold text-indigo-600 underline hover:text-indigo-800"
                  >
                    Use this price
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-indigo-900">{suggestion.reasoning}</p>
              </div>
            )}
          </div>

          {/* Form fields */}
          <div className="card space-y-5 p-6">
            <h3 className="font-semibold text-slate-900">Your Offer</h3>

            {saveError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
                {saveError}
              </div>
            )}

            <div>
              <label className="label" htmlFor="bid-price">
                Bid amount ($) <span className="text-red-400">*</span>
              </label>
              <input
                id="bid-price"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="e.g. 320.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={`input ${
                  submitAttempted && !price
                    ? "border-red-400 focus:ring-red-400/20 focus:border-red-400"
                    : ""
                }`}
              />
              {submitAttempted && !price && (
                <p className="mt-1 text-xs text-red-500">Required</p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="delivery-date">
                Delivery date <span className="text-red-400">*</span>
              </label>
              <input
                id="delivery-date"
                type="date"
                required
                min={today}
                max={order.deadline}
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className={`input ${
                  submitAttempted && !deliveryDate
                    ? "border-red-400 focus:ring-red-400/20 focus:border-red-400"
                    : ""
                }`}
              />
              {submitAttempted && !deliveryDate && (
                <p className="mt-1 text-xs text-red-500">Required</p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="bid-notes">
                Notes{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="bid-notes"
                rows={4}
                placeholder="Delivery conditions, certifications, minimum order info…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input resize-none leading-relaxed"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="btn-primary w-full justify-center py-3.5 text-base disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Submitting…
                </>
              ) : (
                "Submit Bid"
              )}
            </button>

            {submitAttempted && (!price || !deliveryDate) && (
              <p className="text-center text-sm text-red-500">
                Please fill in all required fields.
              </p>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ─── Layout shell ──────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">{children}</div>
    </div>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

function ArrowLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
    </svg>
  );
}
