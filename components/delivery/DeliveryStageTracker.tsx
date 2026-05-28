"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateDeliveryStatus } from "@/app/delivery/actions";

const STEPS = [
  { key: "pending",   label: "Created"   },
  { key: "claimed",   label: "Assigned"  },
  { key: "picked_up", label: "Picked Up" },
  { key: "delivered", label: "Delivered" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export default function DeliveryStageTracker({
  deliveryId,
  initialStatus,
  initialClaimedAt,
  initialPickedUpAt,
  initialDeliveredAt,
  deliveredByLabel,
  canUpdate = false,
}: {
  deliveryId: string;
  initialStatus: string;
  initialClaimedAt?: string | null;
  initialPickedUpAt?: string | null;
  initialDeliveredAt?: string | null;
  /** e.g. "Delivered by supplier" or "Partner: Acme Logistics ★4.2" */
  deliveredByLabel: string;
  /** Show update buttons (supplier updating their own delivery) */
  canUpdate?: boolean;
}) {
  const [status,      setStatus]      = useState(initialStatus);
  const [claimedAt,   setClaimedAt]   = useState(initialClaimedAt   ?? null);
  const [pickedUpAt,  setPickedUpAt]  = useState(initialPickedUpAt  ?? null);
  const [deliveredAt, setDeliveredAt] = useState(initialDeliveredAt ?? null);
  const [error,       setError]       = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`delivery-tracker-${deliveryId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "deliveries", filter: `id=eq.${deliveryId}` },
        (payload) => {
          const row = payload.new as {
            status: string;
            claimed_at:   string | null;
            picked_up_at: string | null;
            delivered_at: string | null;
          };
          setStatus(row.status);
          if (row.claimed_at)   setClaimedAt(row.claimed_at);
          if (row.picked_up_at) setPickedUpAt(row.picked_up_at);
          if (row.delivered_at) setDeliveredAt(row.delivered_at);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [deliveryId]);

  const currentStepIdx = STEPS.findIndex((s) => s.key === status);

  const timestamps: Record<StepKey, string | null> = {
    pending:   null,
    claimed:   claimedAt,
    picked_up: pickedUpAt,
    delivered: deliveredAt,
  };

  const handleUpdate = (newStatus: "picked_up" | "delivered") => {
    setError(null);
    startTransition(async () => {
      const result = await updateDeliveryStatus(deliveryId, newStatus);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div>
      {/* Step progress */}
      <div className="flex items-center justify-between mb-3">
        {STEPS.map((step, i) => {
          const done   = i <= currentStepIdx;
          const isLast = i === STEPS.length - 1;
          return (
            <div key={step.key} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-0.5 min-w-0">
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
                <p className={`text-[10px] font-medium text-center leading-tight ${done ? "text-indigo-600" : "text-slate-400"}`}>
                  {step.label}
                </p>
                {timestamps[step.key] && (
                  <p className="text-[9px] text-slate-400 text-center leading-tight">
                    {new Date(timestamps[step.key]!).toLocaleTimeString([], {
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
              {!isLast && (
                <div
                  className={`mx-1 mb-5 h-0.5 flex-1 transition-colors ${
                    i < currentStepIdx ? "bg-indigo-600" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Who is delivering */}
      <p className="text-xs text-slate-500 mb-3">{deliveredByLabel}</p>

      {/* Update controls — only when supplier is self-delivering */}
      {canUpdate && (
        <>
          {error && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            {status === "claimed" && (
              <button
                onClick={() => handleUpdate("picked_up")}
                disabled={isPending}
                className="btn-primary flex-1 justify-center py-2.5 text-sm disabled:opacity-60"
              >
                {isPending ? "Updating…" : "Mark as Picked Up"}
              </button>
            )}
            {status === "picked_up" && (
              <button
                onClick={() => handleUpdate("delivered")}
                disabled={isPending}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
              >
                {isPending ? "Updating…" : "Mark as Delivered ✓"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
