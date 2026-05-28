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

type BidSuggestion = {
  suggestedPrice: number;
  reasoning: string;
};

type FeeEstimate = {
  estimatedFee: number;
  reasoning: string;
  distanceKm: number;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewBidPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const orderId      = searchParams.get("order_id");

  // ── Order + user state ────────────────────────────────────────────────
  const [order,     setOrder]     = useState<Order | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [supplierLat,    setSupplierLat]    = useState<number | null>(null);
  const [supplierLng,    setSupplierLng]    = useState<number | null>(null);
  const [restaurantLat,  setRestaurantLat]  = useState<number | null>(null);
  const [restaurantLng,  setRestaurantLng]  = useState<number | null>(null);

  // ── Form state ────────────────────────────────────────────────────────
  const [price,         setPrice]         = useState("");
  const [deliveryDate,  setDeliveryDate]  = useState("");
  const [notes,         setNotes]         = useState("");
  // delivery_type: 'supplier' = self-deliver, 'partner' = platform partner
  const [deliveryType,  setDeliveryType]  = useState<"supplier" | "partner">("supplier");
  const [deliveryFee,   setDeliveryFee]   = useState("");

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);
  const [saveError,       setSaveError]       = useState<string | null>(null);

  // ── AI bid suggestion ─────────────────────────────────────────────────
  const [isSuggesting,  setIsSuggesting]  = useState(false);
  const [suggestion,    setSuggestion]    = useState<BidSuggestion | null>(null);
  const [suggestError,  setSuggestError]  = useState<string | null>(null);

  // ── AI fee estimate ───────────────────────────────────────────────────
  const [isEstimating,  setIsEstimating]  = useState(false);
  const [feeEstimate,   setFeeEstimate]   = useState<FeeEstimate | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [hasCoords,     setHasCoords]     = useState(false);

  // ─── Fetch order + coords on mount ────────────────────────────────────

  useEffect(() => {
    if (!orderId) return;

    const supabase = createClient();

    // Fetch order
    supabase
      .from("orders")
      .select(`id, title, deadline, restaurant_id, order_items ( id, name, quantity, unit )`)
      .eq("id", orderId)
      .eq("status", "open")
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setLoadError("Order not found or no longer open.");
        } else {
          setOrder(data as Order);
        }
      });

    // Fetch supplier's own coordinates
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const lat = user.user_metadata?.latitude  as number | null | undefined;
      const lng = user.user_metadata?.longitude as number | null | undefined;
      if (lat && lng) {
        setSupplierLat(lat);
        setSupplierLng(lng);
      }
    });
  }, [orderId]);

  // Fetch restaurant coords once we have the restaurant_id
  useEffect(() => {
    if (!order?.restaurant_id) return;
    const supabase = createClient();
    supabase
      .from("restaurant_profiles")
      .select("latitude, longitude")
      .eq("id", order.restaurant_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.latitude && data?.longitude) {
          setRestaurantLat(data.latitude as number);
          setRestaurantLng(data.longitude as number);
          setHasCoords(true);
        }
      });
  }, [order?.restaurant_id]);

  // ─── Auto-trigger fee estimate when switching to 'partner' ────────────

  useEffect(() => {
    if (deliveryType === "partner" && hasCoords && !feeEstimate && !isEstimating) {
      handleEstimateFee();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryType, hasCoords]);

  // ─── AI suggest bid ───────────────────────────────────────────────────

  const handleSuggest = async () => {
    if (!order) return;
    setIsSuggesting(true);
    setSuggestError(null);
    setSuggestion(null);

    try {
      const res = await fetch("/api/suggest-bid", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ order }),
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

  // ─── AI estimate delivery fee ─────────────────────────────────────────

  const handleEstimateFee = async () => {
    if (!order || !supplierLat || !supplierLng || !restaurantLat || !restaurantLng) return;
    setIsEstimating(true);
    setEstimateError(null);

    try {
      const res = await fetch("/api/estimate-delivery-fee", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          orderItems:    order.order_items,
          supplierLat,
          supplierLng,
          restaurantLat,
          restaurantLng,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Estimation failed");
      setFeeEstimate(data);
      // For partner delivery: fix the fee. For supplier: show as reference.
      if (deliveryType === "partner") {
        setDeliveryFee(String(data.estimatedFee));
      }
    } catch (err) {
      setEstimateError(err instanceof Error ? err.message : "Estimation failed");
    } finally {
      setIsEstimating(false);
    }
  };

  // ─── Submit bid ───────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSubmitAttempted(true);

    const priceOk = !!price;
    const dateOk  = !!deliveryDate;

    if (!priceOk || !dateOk) return;

    setIsSaving(true);
    setSaveError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }

    const supplierName =
      user.user_metadata?.business_name ?? user.email ?? "Unknown Supplier";

    const finalFee = deliveryType === "partner"
      ? (feeEstimate?.estimatedFee ?? 0)
      : parseFloat(deliveryFee) || 0;

    const { error } = await supabase.from("bids").insert({
      order_id:               orderId,
      supplier_id:            user.id,
      supplier_name:          supplierName,
      price:                  parseFloat(price),
      delivery_date:          deliveryDate,
      notes:                  notes.trim() || null,
      status:                 "pending",
      delivery_type:          deliveryType,
      delivery_fee:           finalFee,
      delivery_fee_estimated: deliveryType === "partner",
    });

    if (error) {
      setSaveError(error.message);
      setIsSaving(false);
    } else {
      fetch("/api/notify-new-bid", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ orderId, supplierName }),
      }).catch((e) => console.error("notify-new-bid failed:", e));

      router.push("/supplier/dashboard?bid=submitted");
    }
  };

  // ─── Derived values ───────────────────────────────────────────────────

  const totalPrice = () => {
    const p = parseFloat(price) || 0;
    const f = deliveryType === "partner"
      ? (feeEstimate?.estimatedFee ?? 0)
      : (parseFloat(deliveryFee) || 0);
    return p + f;
  };

  // ─── Guards ───────────────────────────────────────────────────────────

  if (!orderId) {
    return (
      <Shell>
        <div className="py-20 text-center">
          <p className="text-slate-500">No order specified.</p>
          <Link href="/supplier/dashboard" className="btn-primary mt-6 inline-flex">Back to Dashboard</Link>
        </div>
      </Shell>
    );
  }

  if (loadError) {
    return (
      <Shell>
        <div className="py-20 text-center">
          <p className="text-red-500">{loadError}</p>
          <Link href="/supplier/dashboard" className="btn-primary mt-6 inline-flex">Back to Dashboard</Link>
        </div>
      </Shell>
    );
  }

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

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <Shell>
      {/* Header */}
      <div className="mb-8">
        <Link href="/supplier/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800">
          <ArrowLeftIcon /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900">Place a Bid</h1>
        <p className="mt-1 text-sm text-slate-500">Review the order and submit your offer.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Order details */}
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
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Items</p>
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

        {/* Bid form */}
        <div className="lg:col-span-3 space-y-5">
          {/* AI Bid Suggestion */}
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-900">AI Bid Suggestion</h3>
                <p className="mt-0.5 text-xs text-slate-400">Let Claude recommend a competitive goods price.</p>
              </div>
              <button onClick={handleSuggest} disabled={isSuggesting} className="btn-primary shrink-0 px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
                {isSuggesting ? <><Spinner className="h-4 w-4" />Analysing…</> : <><SparkleIcon />Suggest Bid</>}
              </button>
            </div>
            {suggestError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />{suggestError}
              </div>
            )}
            {suggestion && (
              <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="text-xl font-extrabold text-indigo-700">¥{suggestion.suggestedPrice.toLocaleString()}</span>
                  <span className="badge bg-indigo-100 text-indigo-700">Suggested</span>
                  <button onClick={() => setPrice(String(suggestion.suggestedPrice))} className="ml-auto text-xs font-semibold text-indigo-600 underline hover:text-indigo-800">
                    Use this price
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-indigo-900">{suggestion.reasoning}</p>
              </div>
            )}
          </div>

          {/* Delivery method choice */}
          <div className="card p-6 space-y-5">
            <div>
              <h3 className="font-semibold text-slate-900">Delivery method</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Your choice is final — the restaurant sees the total price immediately.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Option A: self-deliver */}
              <label className="relative flex cursor-pointer flex-col">
                <input
                  type="radio"
                  name="deliveryType"
                  value="supplier"
                  checked={deliveryType === "supplier"}
                  onChange={() => setDeliveryType("supplier")}
                  className="peer sr-only"
                />
                <div className="flex flex-col gap-2 rounded-xl border-2 border-slate-200 bg-white p-4 transition-all hover:border-slate-300 peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:ring-2 peer-checked:ring-indigo-200">
                  <span className="text-xl">🚛</span>
                  <p className="text-sm font-semibold text-slate-800">I&apos;ll deliver myself</p>
                  <p className="text-[11px] text-slate-400 leading-snug">You handle the delivery. Enter your own fee below.</p>
                </div>
              </label>

              {/* Option B: platform partner */}
              <label className="relative flex cursor-pointer flex-col">
                <input
                  type="radio"
                  name="deliveryType"
                  value="partner"
                  checked={deliveryType === "partner"}
                  onChange={() => setDeliveryType("partner")}
                  className="peer sr-only"
                />
                <div className="flex flex-col gap-2 rounded-xl border-2 border-slate-200 bg-white p-4 transition-all hover:border-slate-300 peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:ring-2 peer-checked:ring-emerald-200">
                  <span className="text-xl">🤝</span>
                  <p className="text-sm font-semibold text-slate-800">Use a delivery partner</p>
                  <p className="text-[11px] text-slate-400 leading-snug">Platform finds a partner. AI sets the fixed fee.</p>
                </div>
              </label>
            </div>

            {/* Delivery fee section */}
            {deliveryType === "supplier" ? (
              <div className="space-y-3">
                {/* AI reference estimate for supplier */}
                {!feeEstimate && hasCoords && (
                  <button
                    type="button"
                    onClick={handleEstimateFee}
                    disabled={isEstimating}
                    className="btn-secondary w-full justify-center py-2 text-sm disabled:opacity-60"
                  >
                    {isEstimating
                      ? <><Spinner className="h-4 w-4" />Estimating…</>
                      : <><SparkleIcon />Get AI fee reference</>}
                  </button>
                )}
                {feeEstimate && deliveryType === "supplier" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                    <p className="font-semibold text-amber-800 mb-1">
                      AI reference: ¥{feeEstimate.estimatedFee.toLocaleString()}
                      <span className="ml-2 text-xs font-normal text-amber-600">
                        ({feeEstimate.distanceKm} km — non-binding)
                      </span>
                    </p>
                    <p className="text-xs text-amber-700">{feeEstimate.reasoning}</p>
                    <button
                      type="button"
                      onClick={() => setDeliveryFee(String(feeEstimate.estimatedFee))}
                      className="mt-2 text-xs font-semibold text-amber-700 underline hover:text-amber-900"
                    >
                      Use suggested amount
                    </button>
                  </div>
                )}
                {estimateError && (
                  <p className="text-xs text-red-500">{estimateError}</p>
                )}
                {!hasCoords && (
                  <p className="text-xs text-slate-400">
                    Add your address in settings to enable AI fee reference.
                  </p>
                )}
                <div>
                  <label className="label" htmlFor="delivery-fee">
                    Your delivery fee (¥) <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="delivery-fee"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="e.g. 800"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    className="input"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Included in the total the restaurant sees.
                  </p>
                </div>
              </div>
            ) : (
              /* Partner delivery: show AI estimate (fixed) */
              <div>
                {isEstimating && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Spinner className="h-4 w-4 text-indigo-500" />
                    Calculating AI delivery fee…
                  </div>
                )}
                {estimateError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    {estimateError}
                    <button onClick={handleEstimateFee} className="ml-auto text-xs font-semibold underline">Retry</button>
                  </div>
                )}
                {feeEstimate && !isEstimating && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl font-extrabold text-emerald-700">
                        ¥{feeEstimate.estimatedFee.toLocaleString()}
                      </span>
                      <span className="badge bg-emerald-100 text-emerald-700">AI Fixed Fee</span>
                      <span className="text-xs text-slate-500">{feeEstimate.distanceKm} km</span>
                    </div>
                    <p className="text-sm leading-relaxed text-emerald-900">{feeEstimate.reasoning}</p>
                    <p className="mt-2 text-xs text-emerald-700 font-medium">
                      This fee is final. It will be included in your bid and offered to delivery partners.
                    </p>
                  </div>
                )}
                {!hasCoords && !isEstimating && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    <p className="font-semibold">Coordinates required for AI fee estimation</p>
                    <p className="text-xs mt-1">
                      Your profile or the restaurant&apos;s profile is missing coordinates.
                      Please update your address in supplier settings, or choose &ldquo;I&apos;ll deliver myself&rdquo;.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bid details */}
          <div className="card space-y-5 p-6">
            <h3 className="font-semibold text-slate-900">Your Offer</h3>

            {saveError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />{saveError}
              </div>
            )}

            <div>
              <label className="label" htmlFor="bid-price">
                Goods price (¥) <span className="text-red-400">*</span>
              </label>
              <input
                id="bid-price"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="e.g. 32000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={`input ${submitAttempted && !price ? "border-red-400 focus:ring-red-400/20 focus:border-red-400" : ""}`}
              />
              {submitAttempted && !price && <p className="mt-1 text-xs text-red-500">Required</p>}
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
                className={`input ${submitAttempted && !deliveryDate ? "border-red-400 focus:ring-red-400/20 focus:border-red-400" : ""}`}
              />
              {submitAttempted && !deliveryDate && <p className="mt-1 text-xs text-red-500">Required</p>}
            </div>

            <div>
              <label className="label" htmlFor="bid-notes">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="bid-notes"
                rows={3}
                placeholder="Delivery conditions, certifications, minimum order info…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input resize-none leading-relaxed"
              />
            </div>

            {/* Total preview */}
            {(price || deliveryFee) && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                  Restaurant sees
                </p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Goods</span>
                    <span className="font-medium text-slate-800">¥{(parseFloat(price) || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Delivery</span>
                    <span className="font-medium text-slate-800">
                      ¥{(deliveryType === "partner"
                        ? (feeEstimate?.estimatedFee ?? 0)
                        : (parseFloat(deliveryFee) || 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                    <span className="font-semibold text-slate-900">Total</span>
                    <span className="text-lg font-extrabold text-indigo-700">
                      ¥{totalPrice().toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isSaving || (deliveryType === "partner" && !feeEstimate)}
              className="btn-primary w-full justify-center py-3.5 text-base disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving
                ? <><Spinner className="h-4 w-4" />Submitting…</>
                : deliveryType === "partner" && !feeEstimate
                ? "Waiting for fee estimate…"
                : "Submit Bid"}
            </button>

            {submitAttempted && (!price || !deliveryDate) && (
              <p className="text-center text-sm text-red-500">Please fill in all required fields.</p>
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
