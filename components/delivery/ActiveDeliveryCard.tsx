"use client";

import { useState, useTransition } from "react";
import { updateDeliveryStatus } from "@/app/delivery/actions";

type OrderItem = { name: string; quantity: number; unit: string };

type ActiveDelivery = {
  id: string;
  status: "claimed" | "picked_up";
  pickup_address: string | null;
  dropoff_address: string | null;
  claimed_at: string | null;
  picked_up_at: string | null;
  order_id: string;
  orderTitle: string;
  orderItems: OrderItem[];
};

const STEPS = [
  { key: "pending",   label: "Delivery Created" },
  { key: "claimed",   label: "Claimed"          },
  { key: "picked_up", label: "Picked Up"        },
  { key: "delivered", label: "Delivered"        },
] as const;

export default function ActiveDeliveryCard({ delivery }: { delivery: ActiveDelivery }) {
  const [status, setStatus] = useState(delivery.status);
  const [error, setError]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentStepIdx = STEPS.findIndex((s) => s.key === status);

  const handleUpdate = (newStatus: "picked_up" | "delivered") => {
    setError(null);
    startTransition(async () => {
      const result = await updateDeliveryStatus(delivery.id, newStatus);
      if (result.error) {
        setError(result.error);
      } else {
        setStatus(newStatus === "picked_up" ? "picked_up" : "picked_up"); // stays rendered until page reload on delivered
      }
    });
  };

  return (
    <div className="card p-6">
      {/* Order title + status */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{delivery.orderTitle}</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            {status === "claimed" ? "Ready to pick up" : "En route to restaurant"}
          </p>
        </div>
        <span className={`badge shrink-0 ${status === "claimed" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"}`}>
          {status === "claimed" ? "Claimed" : "Picked Up"}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => {
            const done    = i <= currentStepIdx;
            const isLast  = i === STEPS.length - 1;
            return (
              <div key={step.key} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      done ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {done ? (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <p className={`text-[10px] font-medium ${done ? "text-indigo-600" : "text-slate-400"}`}>
                    {step.label}
                  </p>
                </div>
                {!isLast && (
                  <div
                    className={`mx-1 mb-4 h-0.5 flex-1 transition-colors ${
                      i < currentStepIdx ? "bg-indigo-600" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Addresses */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Pickup</p>
          <p className="text-sm font-medium text-slate-800">{delivery.pickup_address ?? "Address TBC"}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Dropoff</p>
          <p className="text-sm font-medium text-slate-800">{delivery.dropoff_address ?? "Address TBC"}</p>
        </div>
      </div>

      {/* Items */}
      {delivery.orderItems.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Items ({delivery.orderItems.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {delivery.orderItems.map((item, i) => (
              <span key={i} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                {item.quantity} {item.unit} {item.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {status === "claimed" && (
          <button
            onClick={() => handleUpdate("picked_up")}
            disabled={isPending}
            className="btn-primary flex-1 justify-center py-3 disabled:opacity-60"
          >
            {isPending ? "Updating…" : "Mark as Picked Up"}
          </button>
        )}
        {status === "picked_up" && (
          <button
            onClick={() => handleUpdate("delivered")}
            disabled={isPending}
            className="flex-1 justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isPending ? "Updating…" : "Mark as Delivered ✓"}
          </button>
        )}
      </div>
    </div>
  );
}
