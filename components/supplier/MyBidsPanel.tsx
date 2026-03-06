"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export type SupplierBid = {
  id: string;
  order_id: string;
  price: number;
  status: string;
  orders: { title: string } | null;
};

const statusConfig: Record<string, { label: string; badgeCls: string; cardCls: string }> = {
  pending:  {
    label: "Pending",
    badgeCls: "bg-amber-100 text-amber-700",
    cardCls:  "border-slate-200",
  },
  won:      {
    label: "Accepted",
    badgeCls: "bg-emerald-100 text-emerald-800",
    cardCls:  "border-emerald-300 bg-emerald-50",
  },
  rejected: {
    label: "Rejected",
    badgeCls: "bg-red-100 text-red-700",
    cardCls:  "border-red-300 bg-red-50",
  },
};

type TabKey = "all" | "pending" | "won" | "rejected";

const TABS: { key: TabKey; label: string; activeCls: string }[] = [
  { key: "all",      label: "All",      activeCls: "bg-indigo-600 text-white"   },
  { key: "pending",  label: "Pending",  activeCls: "bg-amber-500 text-white"    },
  { key: "won",      label: "Won",      activeCls: "bg-emerald-600 text-white"  },
  { key: "rejected", label: "Rejected", activeCls: "bg-red-500 text-white"      },
];

export default function MyBidsPanel({
  initialBids,
  userId,
}: {
  initialBids: SupplierBid[];
  userId: string;
}) {
  const [bids, setBids]       = useState<SupplierBid[]>(initialBids);
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("supplier-bids-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bids",
          filter: `supplier_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as { id: string; status: string; price: number };
          setBids((prev) =>
            prev.map((bid) =>
              bid.id === updated.id
                ? { ...bid, status: updated.status, price: updated.price }
                : bid
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Counts per tab (always computed from full bids list, not filtered)
  const counts: Record<TabKey, number> = {
    all:      bids.length,
    pending:  bids.filter((b) => b.status === "pending").length,
    won:      bids.filter((b) => b.status === "won").length,
    rejected: bids.filter((b) => b.status === "rejected").length,
  };

  const visibleBids =
    activeTab === "all" ? bids : bids.filter((b) => b.status === activeTab);

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
                isActive
                  ? activeCls
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
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
          const orderTitle = bid.orders?.title ?? "—";
          const isWon      = bid.status === "won";
          const isRejected = bid.status === "rejected";
          const isClickable = isWon || isRejected;

          const cardContent = (
            <>
              <p className="mb-2 text-sm font-semibold leading-snug text-slate-800">
                {orderTitle}
              </p>

              <div className="flex items-center justify-between gap-2">
                <p className={`text-xl font-extrabold ${isWon ? "text-emerald-700" : isRejected ? "text-red-600" : "text-slate-900"}`}>
                  ${bid.price.toLocaleString()}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className={`badge ${s.badgeCls}`}>{s.label}</span>
                  {isClickable && (
                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </div>
              </div>

              {isWon && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Your bid was accepted — tap to view details
                </p>
              )}
              {isRejected && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-500">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  This bid was not selected — tap to view details
                </p>
              )}
            </>
          );

          return isClickable ? (
            <Link
              key={bid.id}
              href={`/supplier/bids/${bid.id}`}
              className={`card block border p-4 transition-all hover:shadow-md ${s.cardCls}`}
            >
              {cardContent}
            </Link>
          ) : (
            <div key={bid.id} className={`card border p-4 ${s.cardCls}`}>
              {cardContent}
            </div>
          );
        })
      )}
    </div>
  );
}
