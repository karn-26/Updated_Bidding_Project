"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rateDeliveryPartner } from "@/app/delivery/actions";

export default function DeliveryRatingForm({
  deliveryId,
  deliveryPartnerId,
  partnerName,
}: {
  deliveryId:        string;
  deliveryPartnerId: string;
  partnerName:       string;
}) {
  const router = useRouter();
  const [rating, setRating]     = useState(0);
  const [hovered, setHovered]   = useState(0);
  const [review, setReview]     = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setError("Please select a star rating."); return; }
    setError(null);

    startTransition(async () => {
      const result = await rateDeliveryPartner(deliveryId, deliveryPartnerId, rating, review);
      if (result.error) setError(result.error);
      else router.push(`/delivery/rate/${deliveryId}?done=1`);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-6">
      {/* Star selector */}
      <div>
        <label className="label">Rating</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(star)}
              className="transition-transform hover:scale-110"
              aria-label={`${star} star${star !== 1 ? "s" : ""}`}
            >
              <svg
                className={`h-9 w-9 transition-colors ${
                  star <= (hovered || rating) ? "text-amber-400" : "text-slate-200"
                }`}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="mt-1 text-xs text-slate-500">
            {["", "Poor", "Fair", "Good", "Very good", "Excellent"][rating]}
          </p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="review">
          Review <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="review"
          rows={3}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder={`How was ${partnerName}?`}
          className="input resize-none"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || rating === 0}
        className="btn-primary w-full justify-center py-3 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? "Submitting…" : "Submit Rating"}
      </button>
    </form>
  );
}
