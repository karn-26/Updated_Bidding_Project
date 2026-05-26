"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { claimDelivery } from "@/app/delivery/actions";

type OrderItem = { name: string; quantity: number; unit: string };

export type PendingDelivery = {
  id: string;
  status: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  created_at: string;
  orderTitle: string;
  orderItems: OrderItem[];
};

export default function LiveDeliveriesFeed({
  initialDeliveries,
  userId,
  hasActiveDelivery,
}: {
  initialDeliveries: PendingDelivery[];
  userId: string;
  hasActiveDelivery: boolean;
}) {
  const [deliveries, setDeliveries] = useState<PendingDelivery[]>(initialDeliveries);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("delivery-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "deliveries" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            status: string;
            pickup_address: string | null;
            dropoff_address: string | null;
            created_at: string;
            order_id: string;
            delivery_partner_id: string | null;
          };

          // Only surface pending unclaimed deliveries
          if (row.status !== "pending" || row.delivery_partner_id !== null) return;

          // Fetch the related order to get title and items
          const { data: order } = await supabase
            .from("orders")
            .select("title, order_items ( name, quantity, unit )")
            .eq("id", row.order_id)
            .single();

          const orderItems = (order?.order_items ?? []) as OrderItem[];

          setDeliveries((prev) => {
            if (prev.some((d) => d.id === row.id)) return prev;
            return [
              {
                id:              row.id,
                status:          row.status,
                pickup_address:  row.pickup_address,
                dropoff_address: row.dropoff_address,
                created_at:      row.created_at,
                orderTitle:      order?.title ?? "—",
                orderItems,
              },
              ...prev,
            ];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "deliveries" },
        (payload) => {
          const row = payload.new as { id: string; status: string; delivery_partner_id: string | null };
          // Remove from list if it's been claimed by anyone (status no longer pending)
          if (row.status !== "pending") {
            setDeliveries((prev) => prev.filter((d) => d.id !== row.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleClaim = (deliveryId: string) => {
    if (hasActiveDelivery) {
      setErrors((prev) => ({
        ...prev,
        [deliveryId]: "You already have an active delivery. Complete it before claiming another.",
      }));
      return;
    }

    setClaimingId(deliveryId);
    setErrors((prev) => { const n = { ...prev }; delete n[deliveryId]; return n; });

    startTransition(async () => {
      const result = await claimDelivery(deliveryId);
      if (result.error) {
        setErrors((prev) => ({ ...prev, [deliveryId]: result.error! }));
      } else {
        // Remove from list immediately — realtime will also fire
        setDeliveries((prev) => prev.filter((d) => d.id !== deliveryId));
      }
      setClaimingId(null);
    });
  };

  if (deliveries.length === 0) {
    return (
      <div className="card py-16 text-center">
        <p className="text-slate-400">No deliveries available right now.</p>
        <p className="mt-1 text-sm text-slate-400">
          New deliveries will appear here in real time when a restaurant accepts a bid.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deliveries.map((delivery) => (
        <div key={delivery.id} className="card p-6 transition hover:shadow-card-hover">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{delivery.orderTitle}</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Posted {new Date(delivery.created_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
            <span className="badge bg-indigo-100 text-indigo-700 shrink-0">Available</span>
          </div>

          {/* Addresses */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Pickup
              </p>
              <p className="text-sm font-medium text-slate-800">
                {delivery.pickup_address ?? "Address TBC"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Dropoff
              </p>
              <p className="text-sm font-medium text-slate-800">
                {delivery.dropoff_address ?? "Address TBC"}
              </p>
            </div>
          </div>

          {/* Items summary */}
          {delivery.orderItems.length > 0 && (
            <div className="mb-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Items ({delivery.orderItems.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {delivery.orderItems.slice(0, 4).map((item, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600"
                  >
                    {item.quantity} {item.unit} {item.name}
                  </span>
                ))}
                {delivery.orderItems.length > 4 && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-400">
                    +{delivery.orderItems.length - 4} more
                  </span>
                )}
              </div>
            </div>
          )}

          {errors[delivery.id] && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {errors[delivery.id]}
            </p>
          )}

          <button
            onClick={() => handleClaim(delivery.id)}
            disabled={claimingId === delivery.id || isPending}
            className="btn-primary w-full justify-center py-3 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {claimingId === delivery.id ? "Claiming…" : "Claim Delivery"}
          </button>
        </div>
      ))}
    </div>
  );
}
