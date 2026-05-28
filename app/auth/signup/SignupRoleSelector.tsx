"use client";

import { useState } from "react";

const ROLES = [
  {
    value: "restaurant_owner",
    emoji: "🍽️",
    title: "Restaurant Owner",
    desc:  "Post orders & find suppliers",
    accent: "indigo" as const,
  },
  {
    value: "supplier",
    emoji: "📦",
    title: "Supplier",
    desc:  "Browse orders & submit bids",
    accent: "emerald" as const,
  },
  {
    value: "delivery_partner",
    emoji: "🚚",
    title: "Delivery Partner",
    desc:  "Claim & fulfil deliveries",
    accent: "amber" as const,
  },
];

// Simple postal code validator: NNN-NNNN (Japanese format)
function isValidPostalCode(code: string): boolean {
  return /^\d{3}-\d{4}$/.test(code.trim());
}

export default function SignupRoleSelector({
  signUpAction,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signUpAction: (formData: FormData) => any;
}) {
  const [role,        setRole]        = useState("restaurant_owner");
  const [postalCode,  setPostalCode]  = useState("");
  const [postalError, setPostalError] = useState(false);
  const [submitted,   setSubmitted]   = useState(false);

  const handlePostalChange = (val: string) => {
    // Auto-insert hyphen after 3 digits
    const digits = val.replace(/\D/g, "");
    const formatted = digits.length > 3
      ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}`
      : digits;
    setPostalCode(formatted);
    if (submitted) setPostalError(!isValidPostalCode(formatted));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setSubmitted(true);
    const valid = isValidPostalCode(postalCode);
    const form  = e.currentTarget;
    const prefecture  = (form.elements.namedItem("prefecture")  as HTMLInputElement)?.value?.trim();
    const city_ward   = (form.elements.namedItem("city_ward")   as HTMLInputElement)?.value?.trim();
    const block_banchi = (form.elements.namedItem("block_banchi") as HTMLInputElement)?.value?.trim();

    if (!valid || !prefecture || !city_ward || !block_banchi) {
      e.preventDefault();
      setPostalError(!valid);
      return;
    }
  };

  return (
    <form action={signUpAction} onSubmit={handleSubmit} className="space-y-6">
      {/* Role picker */}
      <div>
        <label className="label">I am a&hellip;</label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ROLES.map(({ value, emoji, title, desc, accent }) => {
            const ring = {
              indigo:  "peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:ring-2 peer-checked:ring-indigo-200",
              emerald: "peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:ring-2 peer-checked:ring-emerald-200",
              amber:   "peer-checked:border-amber-500 peer-checked:bg-amber-50 peer-checked:ring-2 peer-checked:ring-amber-200",
            }[accent];
            return (
              <label key={value} className="relative flex cursor-pointer flex-col">
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                  className="peer sr-only"
                />
                <div className={`flex flex-col items-center gap-2 rounded-xl border-2 border-slate-200 bg-white p-4 text-center transition-all hover:border-slate-300 ${ring}`}>
                  <span className="text-2xl">{emoji}</span>
                  <p className="text-sm font-semibold text-slate-800">{title}</p>
                  <p className="text-[11px] text-slate-400 leading-snug">{desc}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="business_name">Business name</label>
        <input
          id="business_name"
          name="business_name"
          type="text"
          required
          placeholder="e.g. The Golden Fork"
          className="input"
        />
      </div>

      <div>
        <label className="label" htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="input"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="Min. 6 characters"
          className="input"
        />
      </div>

      {/* Japanese address — required for all roles */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Business address (Japan)
        </p>
        <p className="text-xs text-slate-400 -mt-2">
          Used for delivery distance calculations. All fields required.
        </p>

        {/* Postal code */}
        <div>
          <label className="label" htmlFor="postal_code">
            郵便番号 (Postal code) <span className="text-red-400">*</span>
          </label>
          <input
            id="postal_code"
            name="postal_code"
            type="text"
            required
            placeholder="e.g. 150-0001"
            maxLength={8}
            value={postalCode}
            onChange={(e) => handlePostalChange(e.target.value)}
            className={`input ${postalError ? "border-red-400 focus:ring-red-400/20 focus:border-red-400" : ""}`}
          />
          {postalError && (
            <p className="mt-1 text-xs text-red-500">
              Enter a valid postal code (e.g. 150-0001)
            </p>
          )}
        </div>

        {/* Prefecture */}
        <div>
          <label className="label" htmlFor="prefecture">
            都道府県 (Prefecture) <span className="text-red-400">*</span>
          </label>
          <input
            id="prefecture"
            name="prefecture"
            type="text"
            required
            placeholder="e.g. 東京都"
            className="input"
          />
        </div>

        {/* City / Ward */}
        <div>
          <label className="label" htmlFor="city_ward">
            市区町村 (City / Ward) <span className="text-red-400">*</span>
          </label>
          <input
            id="city_ward"
            name="city_ward"
            type="text"
            required
            placeholder="e.g. 渋谷区"
            className="input"
          />
        </div>

        {/* Block / Banchi */}
        <div>
          <label className="label" htmlFor="block_banchi">
            丁目・番地 (Block / Street number) <span className="text-red-400">*</span>
          </label>
          <input
            id="block_banchi"
            name="block_banchi"
            type="text"
            required
            placeholder="e.g. 神南1-2-3"
            className="input"
          />
        </div>
      </div>

      <button type="submit" className="btn-primary w-full py-3">
        Create account
      </button>
    </form>
  );
}
