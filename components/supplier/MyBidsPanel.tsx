"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import DeliveryStageTracker from "@/components/delivery/DeliveryStageTracker";

export type SupplierBid = {
  id: string;
  order_id: string;
  price: number;
  status: string;
  orders: { title: string }[] | null;
  deliveryStatus?: string | null;
  deliveryId?: string | null;
  deliveryMethod?: string | null;
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
          const row = payload.new as { id: string; order_id: string; price: number; status: string };
          const { data: order } = await supabase
            .from("orders")
            .select("title")
            .eq("id", row.order_id)
            .single();
          setBids((prev) => {
            if (prev.some((b) => b.id === row.id)) return prev;
            return [
              { id: row.id, order_id: row.order_id, price: row.price, status: row.status, orders: order ? [{ title: order.title }] : null },
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
        visibleBids.map((bid) => {
          const s          = statusConfig[bid.status] ?? statusConfig.pending;
          const orderTitle = bid.orders?.[0]?.title ?? "—";
          const isWon      = bid.status === "won";
          const isRejected = bid.status === "rejected";
          const isPending  = bid.status === "pending";

          const isSupplierDelivery = bid.deliveryMethod === "supplier";
          // Supplier sees update controls only when they are the deliverer
          const canUpdate = isWon && isSupplierDelivery && !!bid.deliveryId;

          const deliveredByLabel = isSupplierDelivery
            ? "You are delivering this order"
            : "A delivery partner is handling this";

          return (
            <div key={bid.id} className={`card border p-4 ${s.cardCls}`}>
              <p className="mb-2 text-sm font-semibold leading-snug text-slate-800">{orderTitle}</p>

              <div className="flex items-center justify-between gap-2">
                <p className={`text-xl font-extrabold ${isWon ? "text-emerald-700" : isRejected ? "text-red-600" : "text-slate-900"}`}>
                  ${bid.price.toLocaleString()}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className={`badge ${s.badgeCls}`}>{s.label}</span>
                  {(isPending || isRejected) && (
                    <Link href={`/supplier/bids/${bid.id}`}>
                      <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </Link>
                  )}
                </div>
              </div>

              {isPending && (
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
        })
      )}
    </div>
  );
}
