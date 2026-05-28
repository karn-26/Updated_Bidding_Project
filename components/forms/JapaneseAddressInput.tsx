"use client";

import { useEffect, useState } from "react";
import { PREFECTURES } from "@/lib/japan/prefectures";

interface Props {
  /** Fires whenever overall validity changes — use to gate form submission */
  onValidChange?: (valid: boolean) => void;
  /** Set true when the parent form is submitted to reveal inline errors */
  showErrors?: boolean;
  /** Optional initial values (e.g. for settings pages) */
  initialPostalCode?: string;
  initialPrefecture?: string;
  initialCityWard?: string;
  initialBlockBanchi?: string;
}

function isValidPostalCode(code: string): boolean {
  return /^\d{3}-\d{4}$/.test(code.trim());
}

export default function JapaneseAddressInput({
  onValidChange,
  showErrors = false,
  initialPostalCode  = "",
  initialPrefecture  = "",
  initialCityWard    = "",
  initialBlockBanchi = "",
}: Props) {
  const [postalCode,  setPostalCode]  = useState(initialPostalCode);
  const [prefecture,  setPrefecture]  = useState(initialPrefecture);
  const [cityWard,    setCityWard]    = useState(initialCityWard);
  const [blockBanchi, setBlockBanchi] = useState(initialBlockBanchi);
  const [lat,         setLat]         = useState<number | "">("");
  const [lng,         setLng]         = useState<number | "">("");
  const [looking,     setLooking]     = useState(false);

  // Notify parent whenever validity changes
  useEffect(() => {
    const valid =
      isValidPostalCode(postalCode) &&
      prefecture.trim() !== "" &&
      cityWard.trim()   !== "" &&
      blockBanchi.trim() !== "";
    onValidChange?.(valid);
  }, [postalCode, prefecture, cityWard, blockBanchi, onValidChange]);

  // Lazy-load postal dataset only when we have 7 digits
  const runPostalLookup = (formatted: string) => {
    setLooking(true);
    import("@/lib/jp_postal")
      .then(({ lookupPostalCode }) => {
        const result = lookupPostalCode(formatted);
        if (result) {
          setPrefecture(result.prefecture);
          setCityWard(result.city);
          setLat(result.lat);
          setLng(result.lng);
        } else {
          setLat("");
          setLng("");
        }
      })
      .finally(() => setLooking(false));
  };

  const handlePostalChange = (raw: string) => {
    const digits    = raw.replace(/\D/g, "");
    const formatted = digits.length > 3
      ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}`
      : digits;
    setPostalCode(formatted);

    if (digits.length === 7) {
      runPostalLookup(formatted);
    } else {
      setLat("");
      setLng("");
    }
  };

  // When prefecture is manually changed and we have no coords yet, fall back to centroid
  const handlePrefectureChange = (val: string) => {
    setPrefecture(val);
    if (lat === "" && lng === "") {
      import("@/lib/jp_postal").then(({ lookupPrefecture }) => {
        const coords = lookupPrefecture(val);
        if (coords) {
          setLat(coords.lat);
          setLng(coords.lng);
        }
      });
    }
  };

  const postalInvalid = showErrors && !isValidPostalCode(postalCode);

  return (
    <div className="space-y-4">
      {/* Postal code */}
      <div>
        <label className="label" htmlFor="postal_code">
          郵便番号 (Postal code) <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input
            id="postal_code"
            name="postal_code"
            type="text"
            required
            placeholder="150-0001"
            maxLength={8}
            value={postalCode}
            onChange={(e) => handlePostalChange(e.target.value)}
            className={`input pr-24 ${postalInvalid ? "border-red-400 focus:ring-red-400/20 focus:border-red-400" : ""}`}
          />
          {looking && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-pulse text-xs text-slate-400">
              Looking up…
            </span>
          )}
        </div>
        {postalInvalid && (
          <p className="mt-1 text-xs text-red-500">
            Enter a valid postal code (e.g. 150-0001)
          </p>
        )}
      </div>

      {/* Prefecture — bilingual dropdown */}
      <div>
        <label className="label" htmlFor="prefecture">
          都道府県 (Prefecture) <span className="text-red-400">*</span>
        </label>
        <select
          id="prefecture"
          name="prefecture"
          required
          value={prefecture}
          onChange={(e) => handlePrefectureChange(e.target.value)}
          className={`select ${showErrors && !prefecture ? "border-red-400 focus:ring-red-400/20 focus:border-red-400" : ""}`}
        >
          <option value="">— Select prefecture —</option>
          {PREFECTURES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.ja} ({p.en})
            </option>
          ))}
        </select>
        {showErrors && !prefecture && (
          <p className="mt-1 text-xs text-red-500">Please select a prefecture</p>
        )}
      </div>

      {/* City / Ward — auto-filled from postal lookup */}
      <div>
        <label className="label" htmlFor="city_ward">
          市区町村 (City / Ward) <span className="text-red-400">*</span>
        </label>
        <input
          id="city_ward"
          name="city_ward"
          type="text"
          required
          placeholder="渋谷区"
          value={cityWard}
          onChange={(e) => setCityWard(e.target.value)}
          className={`input ${showErrors && !cityWard ? "border-red-400 focus:ring-red-400/20 focus:border-red-400" : ""}`}
        />
        {showErrors && !cityWard && (
          <p className="mt-1 text-xs text-red-500">Please enter the city or ward</p>
        )}
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
          placeholder="神南1-2-3"
          value={blockBanchi}
          onChange={(e) => setBlockBanchi(e.target.value)}
          className={`input ${showErrors && !blockBanchi ? "border-red-400 focus:ring-red-400/20 focus:border-red-400" : ""}`}
        />
        {showErrors && !blockBanchi && (
          <p className="mt-1 text-xs text-red-500">Please enter the block / street number</p>
        )}
      </div>

      {/* Lat / lng — populated by lookup, consumed by the server action */}
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />
    </div>
  );
}
