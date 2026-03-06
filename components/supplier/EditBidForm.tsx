"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBid } from "@/app/supplier/bids/actions";

interface Props {
  bidId: string;
  initialPrice: number;
  initialDeliveryDate: string | null;
  initialNotes: string | null;
  orderDeadline: string;
}

export default function EditBidForm({
  bidId,
  initialPrice,
  initialDeliveryDate,
  initialNotes,
  orderDeadline,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(String(initialPrice));
  const [deliveryDate, setDeliveryDate] = useState(initialDeliveryDate ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const handleSave = async () => {
    setSubmitAttempted(true);
    if (!price || !deliveryDate) return;

    setIsSaving(true);
    setError(null);
    const res = await updateBid(bidId, {
      price: parseFloat(price),
      delivery_date: deliveryDate,
      notes: notes.trim(),
    });
    setIsSaving(false);

    if (res.error) {
      setError(res.error);
    } else {
      setEditing(false);
      setSubmitAttempted(false);
      router.refresh();
    }
  };

  const handleCancel = () => {
    setPrice(String(initialPrice));
    setDeliveryDate(initialDeliveryDate ?? "");
    setNotes(initialNotes ?? "");
    setError(null);
    setSubmitAttempted(false);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt className="text-slate-400">Bid amount</dt>
            <dd className="mt-0.5 text-2xl font-extrabold text-slate-900">
              ${initialPrice.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Proposed delivery</dt>
            <dd className="mt-0.5 font-semibold text-slate-800">{initialDeliveryDate ?? "—"}</dd>
          </div>
          {initialNotes && (
            <div className="col-span-2">
              <dt className="text-slate-400">Notes</dt>
              <dd className="mt-0.5 leading-relaxed text-slate-700">{initialNotes}</dd>
            </div>
          )}
        </dl>
        <button
          onClick={() => setEditing(true)}
          className="btn-secondary mt-5 inline-flex items-center gap-2 text-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
          Edit Bid
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Editing bid</p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="label" htmlFor="edit-price">
          Bid amount ($) <span className="text-red-400">*</span>
        </label>
        <input
          id="edit-price"
          type="number"
          min="0.01"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className={`input ${submitAttempted && !price ? "border-red-400 focus:ring-red-400/20 focus:border-red-400" : ""}`}
        />
        {submitAttempted && !price && <p className="mt-1 text-xs text-red-500">Required</p>}
      </div>

      <div>
        <label className="label" htmlFor="edit-delivery">
          Delivery date <span className="text-red-400">*</span>
        </label>
        <input
          id="edit-delivery"
          type="date"
          min={today}
          max={orderDeadline}
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          className={`input ${submitAttempted && !deliveryDate ? "border-red-400 focus:ring-red-400/20 focus:border-red-400" : ""}`}
        />
        {submitAttempted && !deliveryDate && <p className="mt-1 text-xs text-red-500">Required</p>}
      </div>

      <div>
        <label className="label" htmlFor="edit-notes">
          Notes <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="edit-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input resize-none leading-relaxed"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary flex-1 justify-center py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving…" : "Save Changes"}
        </button>
        <button onClick={handleCancel} className="btn-secondary px-4 py-2.5">
          Cancel
        </button>
      </div>
    </div>
  );
}
