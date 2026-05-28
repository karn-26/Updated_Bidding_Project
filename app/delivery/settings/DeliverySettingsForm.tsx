"use client";

import { useState, useTransition } from "react";
import JapaneseAddressInput from "@/components/forms/JapaneseAddressInput";
import { updateDeliveryPartnerProfile } from "@/app/delivery/actions";

const VEHICLE_TYPES = [
  { value: "bike",  label: "🚲 Bike"  },
  { value: "car",   label: "🚗 Car"   },
  { value: "van",   label: "🚐 Van"   },
  { value: "truck", label: "🚛 Truck" },
];

export default function DeliverySettingsForm({
  initialValues,
}: {
  initialValues: {
    business_name: string;
    postal_code:   string;
    prefecture:    string;
    city_ward:     string;
    block_banchi:  string;
    phone:         string;
    vehicle_type:  "bike" | "car" | "van" | "truck" | "";
    is_available:  boolean;
  };
}) {
  const [values, setValues] = useState(initialValues);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const hasAllAddressFields =
    !!(initialValues.postal_code && initialValues.prefecture &&
       initialValues.city_ward   && initialValues.block_banchi);
  const [addressValid, setAddressValid] = useState(hasAllAddressFields);
  const [submitted,   setSubmitted]     = useState(false);

  const [isPending, startTransition] = useTransition();

  const set = (field: keyof typeof values, val: string | boolean) =>
    setValues((prev) => ({ ...prev, [field]: val }));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    if (!addressValid) return;
    setSaved(false);
    setError(null);

    const fd = new FormData(e.currentTarget);
    fd.set("is_available", values.is_available ? "true" : "false");

    startTransition(async () => {
      const result = await updateDeliveryPartnerProfile(fd);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-6">
      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Settings saved successfully.
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="label" htmlFor="business_name">Business / display name</label>
        <input
          id="business_name"
          name="business_name"
          type="text"
          value={values.business_name}
          onChange={(e) => set("business_name", e.target.value)}
          className="input"
        />
      </div>

      {/* Japanese address — replaces old City / Country inputs */}
      <div>
        <p className="label">Business address</p>
        <p className="mb-3 text-xs text-slate-400">
          Used to calculate proximity to nearby delivery jobs.
        </p>
        <JapaneseAddressInput
          onValidChange={setAddressValid}
          showErrors={submitted}
          initialPostalCode={values.postal_code}
          initialPrefecture={values.prefecture}
          initialCityWard={values.city_ward}
          initialBlockBanchi={values.block_banchi}
        />
      </div>

      <div>
        <label className="label" htmlFor="phone">Phone number</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={values.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="+81 90-0000-0000"
          className="input"
        />
      </div>

      <div>
        <label className="label">Vehicle type</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VEHICLE_TYPES.map(({ value, label }) => (
            <label key={value} className="relative flex cursor-pointer flex-col">
              <input
                type="radio"
                name="vehicle_type"
                value={value}
                checked={values.vehicle_type === value}
                onChange={() => set("vehicle_type", value)}
                className="peer sr-only"
              />
              <div className="flex flex-col items-center gap-1 rounded-xl border-2 border-slate-200 bg-white p-3 text-center transition-all hover:border-slate-300 peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:ring-2 peer-checked:ring-indigo-200">
                <span className="text-lg">{label.split(" ")[0]}</span>
                <span className="text-xs font-medium text-slate-700">{label.split(" ")[1]}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
        <div>
          <p className="text-sm font-medium text-slate-800">Available for deliveries</p>
          <p className="text-xs text-slate-400">Toggle off to pause new delivery claims</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={values.is_available}
          onClick={() => set("is_available", !values.is_available)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            values.is_available ? "bg-indigo-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              values.is_available ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary w-full justify-center py-3 disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save Settings"}
      </button>
    </form>
  );
}
