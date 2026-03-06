"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { placeOrderFromPreset } from "@/app/presets/actions";

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

interface Props {
  presetId: string;
  presetName: string;
}

export default function QuickOrderButton({ presetId, presetName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deadline, setDeadline] = useState(tomorrow());
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const handleOrder = async () => {
    setIsPlacing(true);
    setError(null);
    const res = await placeOrderFromPreset(presetId, deadline);
    setIsPlacing(false);
    if (res.error) {
      setError(res.error);
    } else {
      setDone(true);
      setOpen(false);
      router.refresh();
      setTimeout(() => setDone(false), 4000);
    }
  };

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Order placed!
      </span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-primary w-full justify-center py-2 text-sm"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Order Now
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="label mb-1 text-xs">Bid deadline for "{presetName}"</label>
        <input
          type="date"
          value={deadline}
          min={today}
          onChange={(e) => setDeadline(e.target.value)}
          className="input py-2 text-sm"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleOrder}
          disabled={isPlacing || !deadline}
          className="btn-primary flex-1 justify-center py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPlacing ? "Placing…" : "Confirm"}
        </button>
        <button
          onClick={() => { setOpen(false); setError(null); }}
          className="btn-secondary px-3 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
