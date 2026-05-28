"use client";

import { acceptBid } from "@/app/bids/actions";

/**
 * Simplified accept flow — the supplier chose delivery method at bid time.
 * The restaurant just confirms acceptance; no delivery choice is presented.
 */
export default function AcceptBidFlow({
  bidId,
  orderId,
}: {
  bidId: string;
  orderId: string;
}) {
  return (
    <form action={acceptBid}>
      <input type="hidden" name="bid_id"   value={bidId} />
      <input type="hidden" name="order_id" value={orderId} />
      <button
        type="submit"
        className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.98]"
      >
        Accept bid
      </button>
    </form>
  );
}
