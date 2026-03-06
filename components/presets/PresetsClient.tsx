"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Preset } from "@/app/presets/page";
import { deletePreset, placeOrderFromPreset } from "@/app/presets/actions";

// ── helpers ──────────────────────────────────────────────────────────────────

function findMatchingPreset(transcript: string, presets: Preset[]): Preset | null {
  const lower = transcript.toLowerCase();
  let best: Preset | null = null;
  let bestLen = 0;
  for (const p of presets) {
    const name = p.name.toLowerCase();
    if (lower.includes(name) && name.length > bestLen) {
      best = p;
      bestLen = name.length;
    }
  }
  return best;
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  presets: Preset[];
}

export default function PresetsClient({ presets: initialPresets }: Props) {
  const router = useRouter();

  // local copy so UI updates instantly after mutations
  const [presets, setPresets] = useState(initialPresets);
  useEffect(() => setPresets(initialPresets), [initialPresets]);

  // ordering state (click flow)
  const [orderingId, setOrderingId] = useState<string | null>(null);
  const [deadline, setDeadline] = useState(tomorrow());
  const [isPlacing, setIsPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);

  // delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // voice state
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceMatch, setVoiceMatch] = useState<Preset | null>(null);
  const [voiceDeadline, setVoiceDeadline] = useState(tomorrow());
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef<unknown>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [listenSeconds, setListenSeconds] = useState(0);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSpeechSupported(
        !!((window as { SpeechRecognition?: unknown }).SpeechRecognition ||
          (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition)
      );
    }
  }, []);

  // ── voice helpers ────────────────────────────────────────────────────────

  const stopListening = useCallback(() => {
    (recognitionRef.current as { stop?: () => void } | null)?.stop?.();
    setIsListening(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;

    setVoiceTranscript("");
    setVoiceMatch(null);
    setVoiceError(null);

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setVoiceTranscript(text.trim());
    };

    rec.onerror = () => stopListening();

    rec.onend = () => {
      setIsListening(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setVoiceTranscript((t) => {
        const matched = findMatchingPreset(t, presets);
        if (matched) {
          setVoiceMatch(matched);
          setVoiceDeadline(tomorrow());
        } else if (t.trim()) {
          setVoiceError(`No preset matched "${t}". Try saying the exact preset name.`);
        }
        return t;
      });
    };

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
    setListenSeconds(0);
    timerRef.current = setInterval(() => setListenSeconds((s) => s + 1), 1000);
  }, [presets, stopListening]);

  useEffect(() => () => {
    (recognitionRef.current as { stop?: () => void } | null)?.stop?.();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // ── actions ───────────────────────────────────────────────────────────────

  const handleOrder = async (presetId: string, dl: string, presetName: string) => {
    setIsPlacing(true);
    setPlaceError(null);
    const res = await placeOrderFromPreset(presetId, dl);
    setIsPlacing(false);
    if (res.error) {
      setPlaceError(res.error);
    } else {
      setOrderingId(null);
      setVoiceMatch(null);
      setVoiceTranscript("");
      setSuccessName(presetName);
      router.refresh();
      setTimeout(() => setSuccessName(null), 5000);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const res = await deletePreset(id);
    setDeletingId(null);
    if (!res.error) {
      setPresets((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    }
  };

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/dashboard" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-extrabold text-slate-900">Preset Orders</h1>
            <p className="mt-1 text-sm text-slate-500">
              Save recurring orders as presets and reorder with one click or a voice command.
            </p>
          </div>
          <Link href="/orders/new" className="btn-primary self-start sm:self-auto">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Order
          </Link>
        </div>

        {/* Success banner */}
        {successName && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <svg className="h-5 w-5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <p className="text-sm font-semibold text-emerald-800">
              Order placed for <span className="font-bold">"{successName}"</span> — suppliers will be notified shortly.
            </p>
          </div>
        )}

        {/* ── Voice Command Section ── */}
        <div className="card mb-8 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100">
              <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Voice Order</h2>
              <p className="text-xs text-slate-500">Say a preset name to place an order hands-free</p>
            </div>
            {!speechSupported && (
              <span className="ml-auto badge bg-red-100 text-red-600">Requires Chrome / Edge</span>
            )}
          </div>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={!speechSupported || presets.length === 0}
              aria-label={isListening ? "Stop listening" : "Start voice command"}
              className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full shadow-md transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
                isListening ? "bg-red-500 hover:bg-red-600 scale-105" : "bg-indigo-600 hover:bg-indigo-700 hover:scale-105"
              }`}
            >
              {isListening && (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-40" />
                  <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-20" style={{ animationDelay: "0.4s" }} />
                </>
              )}
              <svg className="relative h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </button>

            <div className="flex-1 space-y-3 w-full">
              {isListening ? (
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  <span className="text-sm font-semibold text-red-600">Listening · {fmtTime(listenSeconds)}</span>
                  <button onClick={stopListening} className="ml-auto rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100">
                    Stop
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  {presets.length === 0
                    ? "Create a preset first, then use voice to reorder."
                    : 'Tap the mic and say a preset name — e.g. "Order weekly produce"'}
                </p>
              )}

              {voiceTranscript && !isListening && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm text-slate-700">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 mr-2">Heard:</span>
                  "{voiceTranscript}"
                </div>
              )}

              {voiceError && (
                <p className="text-sm text-red-600">{voiceError}</p>
              )}
            </div>
          </div>

          {/* Voice match confirmation */}
          {voiceMatch && (
            <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Matched preset</p>
                  <p className="mt-0.5 font-bold text-slate-900">{voiceMatch.name}</p>
                  <p className="text-xs text-slate-500">{voiceMatch.items.length} item{voiceMatch.items.length !== 1 ? "s" : ""}</p>
                </div>
                <button
                  onClick={() => { setVoiceMatch(null); setVoiceTranscript(""); }}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Dismiss"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <label className="label mb-1 text-xs">Bid deadline</label>
                  <input
                    type="date"
                    value={voiceDeadline}
                    min={today}
                    onChange={(e) => setVoiceDeadline(e.target.value)}
                    className="input py-2 text-sm"
                  />
                </div>
                <button
                  onClick={() => handleOrder(voiceMatch.id, voiceDeadline, voiceMatch.name)}
                  disabled={isPlacing || !voiceDeadline}
                  className="btn-primary mt-4 sm:mt-auto shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isPlacing ? "Placing…" : "Confirm & Place Order"}
                </button>
              </div>
              {placeError && <p className="mt-2 text-sm text-red-600">{placeError}</p>}
            </div>
          )}
        </div>

        {/* ── Preset Cards ── */}
        {presets.length === 0 ? (
          <div className="card flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">📋</div>
            <div>
              <p className="font-semibold text-slate-700">No presets yet</p>
              <p className="mt-1 text-sm text-slate-400">
                When placing a new order, check "Save as preset" to save it here for quick reordering.
              </p>
            </div>
            <Link href="/orders/new" className="btn-primary mt-2">Place your first order</Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {presets.map((preset) => {
              const isOrdering = orderingId === preset.id;
              const isDeleting = deletingId === preset.id;

              return (
                <div key={preset.id} className="card flex flex-col gap-0 overflow-hidden">
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-slate-900">{preset.name}</h3>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {preset.items.length} item{preset.items.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(preset.id)}
                      disabled={isDeleting}
                      aria-label="Delete preset"
                      className="shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>

                  {/* Items preview */}
                  <div className="border-t border-slate-100 px-5 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {preset.items.slice(0, 6).map((item, i) => (
                        <span key={i} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                          {item.quantity} {item.unit} {item.name}
                        </span>
                      ))}
                      {preset.items.length > 6 && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-400">
                          +{preset.items.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Order panel */}
                  <div className="border-t border-slate-100 p-5">
                    {isOrdering ? (
                      <div className="space-y-3">
                        <div>
                          <label className="label mb-1 text-xs">Bid deadline</label>
                          <input
                            type="date"
                            value={deadline}
                            min={today}
                            onChange={(e) => setDeadline(e.target.value)}
                            className="input py-2 text-sm"
                          />
                        </div>
                        {placeError && <p className="text-xs text-red-600">{placeError}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOrder(preset.id, deadline, preset.name)}
                            disabled={isPlacing || !deadline}
                            className="btn-primary flex-1 justify-center py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isPlacing ? "Placing…" : "Confirm Order"}
                          </button>
                          <button
                            onClick={() => { setOrderingId(null); setPlaceError(null); }}
                            className="btn-secondary px-3 py-2 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setOrderingId(preset.id); setDeadline(tomorrow()); setPlaceError(null); }}
                        className="btn-primary w-full justify-center py-2.5 text-sm"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Order Now
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
