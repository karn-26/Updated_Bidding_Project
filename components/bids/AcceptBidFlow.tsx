"use client";

import { useState } from "react";
import { acceptBid } from "@/app/bids/actions";

export default function AcceptBidFlow({
  bidId,
  orderId,
}: {
  bidId: string;
  orderId: string;
}) {
  const [step, setStep] = useState<"idle" | "choosing">("idle");

  if (step === "idle") {
    return (
      <button
        type="button"
        onClick={() => setStep("choosing")}
        className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98]"
      >
        Accept bid
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-slate-800">
        How should this order be delivered?
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <form action={acceptBid}>
          <input type="hidden" name="bid_id"          value={bidId} />
          <input type="hidden" name="order_id"        value={orderId} />
          <input type="hidden" name="delivery_method" value="supplier" />
          <button
            type="submit"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98]"
          >
            🚛 Supplier delivers
          </button>
        </form>
        <form action={acceptBid}>
          <input type="hidden" name="bid_id"          value={bidId} />
          <input type="hidden" name="order_id"        value={orderId} />
          <input type="hidden" name="delivery_method" value="delivery_partner" />
          <button
            type="submit"
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            🤝 Find a delivery partner
          </button>
        </form>
        <button
          type="button"
          onClick={() => setStep("idle")}
          className="text-sm font-medium text-slate-400 transition hover:text-slate-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
