"use client";

import { useState } from "react";
import { submitRating } from "@/app/bids/rating-actions";

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export default function StarRatingForm({
  supplierId,
  orderId,
}: {
  supplierId: string;
  orderId: string;
}) {
  const [hovered,  setHovered]  = useState(0);
  const [selected, setSelected] = useState(0);

  return (
    <form action={submitRating} className="mt-8 space-y-6">
      <input type="hidden" name="supplier_id" value={supplierId} />
      <input type="hidden" name="order_id"    value={orderId} />
      <input type="hidden" name="rating"      value={selected} readOnly />

      {/* Star picker */}
      <div>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setSelected(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
              className="transition-transform hover:scale-110 focus-visible:outline-none"
            >
              <svg
                className={`h-12 w-12 transition-colors ${
                  star <= (hovered || selected)
                    ? "text-amber-400"
                    : "text-slate-200"
                }`}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          ))}
        </div>
        <p className={`mt-3 text-sm font-semibold transition-colors ${
          selected > 0 ? "text-slate-700" : "text-slate-300"
        }`}>
          {selected > 0 ? LABELS[selected] : "Tap a star to rate"}
        </p>
      </div>

      {/* Optional review */}
      <div className="text-left">
        <label className="label" htmlFor="review">
          Leave a comment{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="review"
          name="review"
          rows={3}
          placeholder="How was the quality, punctuality, communication?"
          className="input resize-none leading-relaxed"
        />
      </div>

      <button
        type="submit"
        disabled={selected === 0}
        className="btn-primary w-full justify-center py-3 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Submit Rating
      </button>
    </form>
  );
}
