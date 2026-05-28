"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import DeliveryStageTracker from "@/components/delivery/DeliveryStageTracker";
import { selfDeliverFallback, cancelDeliveryFallback } from "@/app/delivery/actions";

export type SupplierBid = {
  id: string;
  order_id: string;
  price: number;
  delivery_type?: "supplier" | "partner" | null;
  delivery_fee?: number | null;
  delivery_fee_estimated?: boolean | null;
  status: string;
  orders: { title: string }[] | null;
  deliveryStatus?: string | null;
  deliveryId?: string | null;
  deliveryMethod?: string | null;
  partnerDeadline?: string | null;
  claimedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
};

const statusConfig: Record<string, { label: string; badgeCls: string; cardCls: string }> = {
  pending:  { label: "Pending",  badgeCls: "bg-amber-100 text-amber-700",     cardCls: "border-slate-200"                },
  won:      { label: "Accepted", badgeCls: "bg-emerald-100 text-emerald-800", cardCls: "border-emerald-300 bg-emerald-50" },
  rejected: { label: "Rejected", badgeCls: "bg-red-100 text-red-700",         cardCls: "border-red-300 bg-red-50"        },
};

type TabKey = "all" | "pending" | "won" | "rejected";

const TABS: { key: TabKey; label: string; activeCls: string }[] = [
  { key: "all",      label: "All",      activeCls: "bg-indigo-600 text-white"  },
  { key: "pending",  label: "Pending",  activeCls: "bg-amber-500 text-white"   },
  { key: "won",      label: "Won",      activeCls: "bg-emerald-600 text-white" },
  { key: "rejected", label: "Rejected", activeCls: "bg-red-500 text-white"     },
];

export default function MyBidsPanel({
  initialBids,
  userId,
}: {
  initialBids: SupplierBid[];
  userId: string;
}) {
  const [bids, setBids]           = useState<SupplierBid[]>(initialBids);
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("supplier-bids-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids", filter: `supplier_id=eq.${userId}` },
        async (payload) => {
          const row = payload.new as {
            id: string;
            order_id: string;
            price: number;
            delivery_fee: number;
            delivery_type: string;
            status: string;
          };
          const { data: order } = await supabase
            .from("orders")
            .select("title")
            .eq("id", row.order_id)
            .single();
          setBids((prev) => {
            if (prev.some((b) => b.id === row.id)) return prev;
            return [
              {
                id:           row.id,
                order_id:     row.order_id,
                price:        row.price,
                delivery_fee: row.delivery_fee ?? 0,
                delivery_type: row.delivery_type as "supplier" | "partner",
                status:       row.status,
                orders:       order ? [{ title: order.title }] : null,
              },
              ...prev,
            ];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bids", filter: `supplier_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as { id: string; status: string; price: number };
          setBids((prev) =>
            prev.map((bid) =>
              bid.id === updated.id ? { ...bid, status: updated.status, price: updated.price } : bid
            )
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const counts: Record<TabKey, number> = {
    all:      bids.length,
    pending:  bids.filter((b) => b.status === "pending").length,
    won:      bids.filter((b) => b.status === "won").length,
    rejected: bids.filter((b) => b.status === "rejected").length,
  };

  const visibleBids = activeTab === "all" ? bids : bids.filter((b) => b.status === activeTab);

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(({ key, label, activeCls }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive ? activeCls : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"}`}>
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bid cards */}
      {visibleBids.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-slate-400">
            {bids.length === 0 ? "No bids placed yet." : `No ${activeTab} bids.`}
          </p>
        </div>
      ) : (
        visibleBids.map((bid) => (
          <BidCard key={bid.id} bid={bid} />
        ))
      )}
    </div>
  );
}

// ─── Individual bid card ──────────────────────────────────────────────────────

function BidCard({ bid }: { bid: SupplierBid }) {
  const [isPending, startTransition] = useTransition();
  const [fallbackError, setFallbackError] = useState<string | null>(null);

  const s          = statusConfig[bid.status] ?? statusConfig.pending;
  const orderTitle = bid.orders?.[0]?.title ?? "—";
  const isWon      = bid.status === "won";
  const isRejected = bid.status === "rejected";
  const isPendingBid = bid.status === "pending";

  const deliveryFee   = bid.delivery_fee   ?? 0;
  const deliveryType  = bid.delivery_type  ?? "supplier";
  const totalPrice    = bid.price + deliveryFee;

  // Supplier self-delivers when delivery_type='supplier' or when converted via fallback
  const isSupplierDelivery = bid.deliveryMethod === "supplier";
  const canUpdate = isWon && isSupplierDelivery && !!bid.deliveryId;

  // Fallback: partner job timed out (status=pending AND partner_deadline passed)
  const isPartnerDelivery = bid.deliveryMethod === "delivery_partner" || deliveryType === "partner";
  const deadlinePassed = isWon && isPartnerDelivery
    && bid.deliveryStatus === "pending"
    && !!bid.partnerDeadline
    && new Date(bid.partnerDeadline) < new Date();

  const deliveredByLabel = isSupplierDelivery
    ? "You are delivering this order"
    : "A delivery partner is handling this";

  const handleSelfDeliver = () => {
    if (!bid.deliveryId) return;
    setFallbackError(null);
    startTransition(async () => {
      const result = await selfDeliverFallback(bid.deliveryId!);
      if (result.error) setFallbackError(result.error);
    });
  };

  const handleCancel = () => {
    if (!bid.deliveryId) return;
    setFallbackError(null);
    startTransition(async () => {
      const result = await cancelDeliveryFallback(bid.deliveryId!);
      if (result.error) setFallbackError(result.error);
    });
  };

  return (
    <div className={`card border p-4 ${s.cardCls}`}>
      <p className="mb-2 text-sm font-semibold leading-snug text-slate-800">{orderTitle}</p>

      <div className="flex items-center justify-between gap-2">
        <div>
          <p className={`text-xl font-extrabold ${isWon ? "text-emerald-700" : isRejected ? "text-red-600" : "text-slate-900"}`}>
            ¥{totalPrice.toLocaleString()}
          </p>
          {deliveryFee > 0 && (
            <p className="text-[10px] text-slate-400">
              ¥{bid.price.toLocaleString()} + ¥{deliveryFee.toLocaleString()} delivery
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`badge text-[10px] ${deliveryType === "supplier" ? "bg-slate-100 text-slate-600" : "bg-indigo-100 text-indigo-700"}`}>
            {deliveryType === "supplier" ? "🚛 Self" : "🤝 Partner"}
          </span>
          <span className={`badge ${s.badgeCls}`}>{s.label}</span>
          {(isPendingBid || isRejected) && (
            <Link href={`/supplier/bids/${bid.id}`}>
              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          )}
        </div>
      </div>

      {isPendingBid && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-indigo-600">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
          Tap to view or edit this bid
        </p>
      )}

      {isWon && (
        <>
          <p className="mt-2 mb-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Your bid was accepted
          </p>

          {/* Partner fallback banner */}
          {deadlinePassed && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800 mb-2">
                No delivery partner claimed this job in time.
              </p>
              {fallbackError && (
                <p className="mb-2 text-xs text-red-600">{fallbackError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSelfDeliver}
                  disabled={isPending}
                  className="btn-primary flex-1 justify-center py-2 text-xs disabled:opacity-60"
                >
                  {isPending ? "…" : `Deliver myself · ¥${deliveryFee.toLocaleString()}`}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isPending}
                  className="btn-danger flex-1 justify-center py-2 text-xs disabled:opacity-60"
                >
                  {isPending ? "…" : "Cancel order"}
                </button>
              </div>
            </div>
          )}

          {/* Stage tracker */}
          {bid.deliveryId ? (
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <DeliveryStageTracker
                deliveryId={bid.deliveryId}
                initialStatus={bid.deliveryStatus ?? "pending"}
                initialClaimedAt={bid.claimedAt}
                initialPickedUpAt={bid.pickedUpAt}
                initialDeliveredAt={bid.deliveredAt}
                deliveredByLabel={deliveredByLabel}
                canUpdate={canUpdate}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-400">Delivery record pending…</p>
          )}

          {/* Rate delivery partner — only after delivery by a partner */}
          {bid.deliveryStatus === "delivered" &&
            bid.deliveryMethod === "delivery_partner" &&
            bid.deliveryId && (
            <Link
              href={`/delivery/rate/${bid.deliveryId}`}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Rate delivery partner
            </Link>
          )}
        </>
      )}

      {isRejected && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-500">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          This bid was not selected
        </p>
      )}
    </div>
  );
}
