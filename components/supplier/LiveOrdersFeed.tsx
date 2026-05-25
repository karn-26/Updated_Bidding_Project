"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type OrderItem = { id: string; name: string; quantity: number; unit: string };
type Order = {
  id: string;
  title: string;
  deadline: string;
  restaurant_id: string;
  order_items: OrderItem[];
};

export default function LiveOrdersFeed({
  initialOrders,
  biddedOrderIds,
}: {
  initialOrders: Order[];
  biddedOrderIds: string[];
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const bidSet = new Set(biddedOrderIds);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("live-orders-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            title: string;
            deadline: string;
            restaurant_id: string;
            status: string;
          };

          // Only show open orders
          if (row.status !== "open") return;

          // Realtime INSERT payload doesn't include joined order_items — fetch them separately
          const { data: items } = await supabase
            .from("order_items")
            .select("id, name, quantity, unit")
            .eq("order_id", row.id);

          setOrders((prev) => {
            if (prev.some((o) => o.id === row.id)) return prev;
            return [...prev, { ...row, order_items: items ?? [] }].sort(
              (a, b) => a.deadline.localeCompare(b.deadline)
            );
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new as { id: string; status: string };
          // Remove from list if order is no longer open (accepted/cancelled)
          if (row.status !== "open") {
            setOrders((prev) => prev.filter((o) => o.id !== row.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (orders.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-slate-400">No open orders at the moment. Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.id} className="card p-6 transition hover:shadow-card-hover">
          {/* Order header */}
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900">{order.title}</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Deadline{" "}
                <span className="font-medium text-slate-600">{order.deadline}</span>
                {" "}&middot;{" "}
                {order.order_items.length} item{order.order_items.length !== 1 ? "s" : ""}
              </p>
            </div>
            <span className="badge shrink-0 bg-emerald-100 text-emerald-700">Open</span>
          </div>

          {/* Item tags */}
          {order.order_items.length > 0 && (
            <ul className="mb-4 flex flex-wrap gap-2">
              {order.order_items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {item.quantity} {item.unit} {item.name}
                </li>
              ))}
            </ul>
          )}

          {/* Place a bid / already bid */}
          <div className="border-t border-slate-100 pt-4">
            {bidSet.has(order.id) ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Bid Submitted
              </span>
            ) : (
              <Link
                href={`/supplier/bids/new?order_id=${order.id}`}
                className="btn-primary inline-flex px-6"
              >
                Place a Bid
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
