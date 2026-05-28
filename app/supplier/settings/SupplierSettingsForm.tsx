"use client";

import { useState, useTransition } from "react";
import JapaneseAddressInput from "@/components/forms/JapaneseAddressInput";
import { updateSupplierProfile } from "./actions";

export default function SupplierSettingsForm({
  initialAddress,
}: {
  initialAddress: {
    postal_code:  string;
    prefecture:   string;
    city_ward:    string;
    block_banchi: string;
  };
}) {
  const hasAllFields =
    !!(initialAddress.postal_code && initialAddress.prefecture &&
       initialAddress.city_ward   && initialAddress.block_banchi);

  const [addressValid, setAddressValid] = useState(hasAllFields);
  const [submitted,   setSubmitted]   = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    if (!addressValid) return;
    setSaved(false);
    setErrorMsg(null);

    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateSupplierProfile(fd);
      if (result?.error) setErrorMsg(result.error);
      else setSaved(true);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Profile saved successfully.
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <JapaneseAddressInput
        onValidChange={setAddressValid}
        showErrors={submitted}
        initialPostalCode={initialAddress.postal_code}
        initialPrefecture={initialAddress.prefecture}
        initialCityWard={initialAddress.city_ward}
        initialBlockBanchi={initialAddress.block_banchi}
      />

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save Profile"}
      </button>
    </form>
  );
}
