"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createPreset } from "@/app/presets/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "method" | "photo" | "voice" | "extracting" | "review" | "success";
type InputMethod = "photo" | "voice" | "manual";

interface Item {
  id: string;
  name: string;
  quantity: string;
  unit: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UNITS = ["kg", "g", "L", "mL", "units", "cases", "dozen", "bunch", "bag", "box"];

const EXTRACTING_MESSAGES = [
  "Reading your list…",
  "Identifying items…",
  "Normalising quantities…",
  "Organising results…",
];

const uid = () => Math.random().toString(36).slice(2, 9);
const blankItem = (): Item => ({ id: uid(), name: "", quantity: "1", unit: "units" });

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewOrderPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("method");
  const [inputMethod, setInputMethod] = useState<InputMethod | null>(null);

  // ── Photo ────────────────────────────────────────────────────────────────
  const [photo, setPhoto] = useState<{ file: File; dataUrl: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Voice ────────────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<unknown>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shouldRestartSpeechRef = useRef(false);
  const finalTranscriptRef = useRef("");

  // ── Extraction ───────────────────────────────────────────────────────────
  const [extractingMsgIdx, setExtractingMsgIdx] = useState(0);
  const [extractError, setExtractError] = useState<string | null>(null);

  // ── Review ───────────────────────────────────────────────────────────────
  const [items, setItems] = useState<Item[]>([blankItem()]);
  const [orderTitle, setOrderTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [useOrderName, setUseOrderName] = useState(false);

  useEffect(() => {
    if (useOrderName) setPresetName(orderTitle);
  }, [useOrderName, orderTitle]);

  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSpeechSupported(
        !!((window as { SpeechRecognition?: unknown }).SpeechRecognition ||
          (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition)
      );
    }
  }, []);

  // Rotate extracting messages while waiting for Claude
  useEffect(() => {
    if (step !== "extracting") return;
    setExtractingMsgIdx(0);
    const iv = setInterval(
      () => setExtractingMsgIdx((i) => (i + 1) % EXTRACTING_MESSAGES.length),
      1400
    );
    return () => clearInterval(iv);
  }, [step]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      (recognitionRef.current as { stop?: () => void } | null)?.stop?.();
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  // ─── Photo helpers ────────────────────────────────────────────────────────

  const loadPhoto = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) =>
      setPhoto({ file, dataUrl: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  // ─── Voice helpers ────────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    (recognitionRef.current as { stop?: () => void } | null)?.stop?.();
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: (new () => { continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: any) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void } ) | undefined =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) text += " ";
      }
      setTranscript(text.trim());
    };

    recognition.onerror = () => stopRecording();
    recognition.onend = () => {
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setRecordingSeconds(0);
    timerRef.current = setInterval(
      () => setRecordingSeconds((s) => s + 1),
      1000
    );
  }, [stopRecording]);

  // ─── Extraction ────────────────────────────────────────────────────────────

  const extract = async (type: "image" | "text") => {
    setStep("extracting");
    setExtractError(null);

    try {
      const res = await fetch("/api/extract-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          type === "image"
            ? { type: "image", image: photo!.dataUrl, mediaType: photo!.file.type }
            : { type: "text", transcript }
        ),
      });

      const data: { items?: { name: string; quantity: number | string; unit: string }[]; error?: string } =
        await res.json();
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");

      setItems(
        (data.items ?? []).map((item) => ({
          id: uid(),
          name: item.name,
          quantity: String(item.quantity ?? 1),
          unit: item.unit ?? "units",
        }))
      );
      setStep("review");
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed");
      setStep(inputMethod === "photo" ? "photo" : "voice");
    }
  };

  // ─── Review helpers ────────────────────────────────────────────────────────

  const updateItem = (id: string, field: keyof Item, val: string) =>
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );

  const removeItem = (id: string) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));

  const addItem = () => setItems((prev) => [...prev, blankItem()]);

  // ─── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSubmitAttempted(true);
    if (!orderTitle.trim() || !deadline || items.some((i) => !i.name.trim()))
      return;

    setIsSaving(true);
    setSaveError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/auth/login");
      return;
    }

    try {
      // Required Supabase tables — run this SQL in your project:
      //
      // create table orders (
      //   id uuid primary key default gen_random_uuid(),
      //   restaurant_id uuid references auth.users not null,
      //   title text not null,
      //   deadline date not null,
      //   status text not null default 'open',
      //   created_at timestamptz default now()
      // );
      //
      // create table order_items (
      //   id uuid primary key default gen_random_uuid(),
      //   order_id uuid references orders(id) on delete cascade not null,
      //   name text not null,
      //   quantity numeric not null default 1,
      //   unit text not null default 'units'
      // );

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          restaurant_id: user.id,
          title: orderTitle.trim(),
          deadline,
          status: "open",
        })
        .select()
        .single();

      if (orderErr) {
        console.error("Supabase error inserting order:", orderErr);
        throw orderErr;
      }

      const { error: itemsErr } = await supabase.from("order_items").insert(
        items
          .filter((i) => i.name.trim())
          .map((i) => ({
            order_id: order.id,
            name: i.name.trim(),
            quantity: parseFloat(i.quantity) || 1,
            unit: i.unit,
          }))
      );

      if (itemsErr) {
        console.error("Supabase error inserting order items:", itemsErr);
        throw itemsErr;
      }

      // Notify all suppliers about the new order (fire-and-forget)
      fetch("/api/notify-new-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, orderTitle: order.title }),
      }).catch((e) => console.error("notify-new-order failed:", e));

      // Save as preset if requested
      if (saveAsPreset && presetName.trim()) {
        await createPreset(
          presetName.trim(),
          items
            .filter((i) => i.name.trim())
            .map((i) => ({
              name: i.name.trim(),
              quantity: parseFloat(i.quantity) || 1,
              unit: i.unit,
            }))
        );
      }

      setStep("success");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ?? "Failed to save order.";
      console.error("handleSave caught error:", err);
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const today = new Date().toISOString().split("T")[0];

  // ──────────────────────────────────────────────────────────────────────────
  // STEP: METHOD SELECTION
  // ──────────────────────────────────────────────────────────────────────────

  if (step === "method") {
    return (
      <Shell>
        <Header back="/dashboard" title="Place an Order" subtitle="Choose how you'd like to add your items." />

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {/* Photo */}
          <MethodCard
            onClick={() => { setInputMethod("photo"); setStep("photo"); }}
            icon={
              <svg className="h-6 w-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            }
            iconBg="bg-violet-100"
            title="Upload a photo"
            desc="Snap or upload a photo of your handwritten grocery list."
            badge="AI Vision"
            badgeCls="bg-violet-100 text-violet-700"
          />

          {/* Voice */}
          <MethodCard
            onClick={() => { if (!speechSupported) return; setInputMethod("voice"); setStep("voice"); }}
            disabled={!speechSupported}
            icon={
              <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            }
            iconBg="bg-indigo-100"
            title="Record your voice"
            desc={
              speechSupported
                ? "Dictate your order and we'll extract items automatically."
                : "Requires Chrome or Edge — not supported in this browser."
            }
            badge={speechSupported ? "AI Transcription" : "Unsupported"}
            badgeCls={speechSupported ? "bg-indigo-100 text-indigo-700" : "bg-red-100 text-red-600"}
          />

          {/* Manual */}
          <MethodCard
            onClick={() => { setInputMethod("manual"); setItems([blankItem()]); setStep("review"); }}
            icon={
              <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            }
            iconBg="bg-emerald-100"
            title="Type manually"
            desc="Add items one by one — full control, no AI required."
            badge="Classic"
            badgeCls="bg-slate-100 text-slate-600"
          />
        </div>
      </Shell>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP: PHOTO INPUT
  // ──────────────────────────────────────────────────────────────────────────

  if (step === "photo") {
    return (
      <Shell>
        <Header
          back={() => { setPhoto(null); setExtractError(null); setStep("method"); }}
          title="Upload a photo"
          subtitle="Take or upload a clear photo of your handwritten list."
        />

        {extractError && <ErrorBanner message={extractError} />}

        <div className="mt-8 space-y-5">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) loadPhoto(f);
            }}
            className={`relative flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              isDragging
                ? "border-indigo-400 bg-indigo-50"
                : photo
                ? "border-emerald-300 bg-emerald-50/50"
                : "border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/30"
            }`}
          >
            {photo ? (
              <>
                <img
                  src={photo.dataUrl}
                  alt="Uploaded grocery list"
                  className="max-h-56 rounded-xl object-contain shadow-lg"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setPhoto(null); }}
                  className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:text-red-500"
                  aria-label="Remove photo"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <p className="mt-3 text-xs text-slate-500">{photo.file.name} · click to replace</p>
              </>
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200">
                  <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <p className="mt-4 font-semibold text-slate-700">Drop your photo here</p>
                <p className="mt-1 text-sm text-slate-400">or click to browse — JPG, PNG, HEIC, WebP</p>
                <p className="mt-3 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                  📱 On mobile, you can use your camera directly
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) loadPhoto(f); }}
            />
          </div>

          <button
            onClick={() => extract("image")}
            disabled={!photo}
            className="btn-primary w-full justify-center py-3.5 text-base disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <SparkleIcon />
            Extract items with AI
          </button>
        </div>
      </Shell>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP: VOICE INPUT
  // ──────────────────────────────────────────────────────────────────────────

  if (step === "voice") {
    return (
      <Shell>
        <Header
          back={() => { stopRecording(); setTranscript(""); setExtractError(null); setStep("method"); }}
          title="Record your order"
          subtitle='Say your items naturally — e.g. "10 kg tomatoes, 5 litres of olive oil, 3 cases of sparkling water"'
        />

        {extractError && <ErrorBanner message={extractError} />}

        <div className="mt-8 space-y-6">
          {/* Mic button area */}
          <div className="card flex flex-col items-center gap-5 py-10">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
              className={`relative flex h-24 w-24 items-center justify-center rounded-full shadow-lg transition-all duration-200 ${
                isRecording
                  ? "bg-red-500 hover:bg-red-600 scale-105"
                  : "bg-indigo-600 hover:bg-indigo-700 hover:scale-105"
              }`}
            >
              {isRecording && (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-40" />
                  <span
                    className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-20"
                    style={{ animationDelay: "0.4s" }}
                  />
                </>
              )}
              <svg
                className="relative h-10 w-10 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </button>

            {isRecording ? (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <span className="font-mono text-sm font-semibold text-red-600">
                  Recording · {fmtTime(recordingSeconds)}
                </span>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                {transcript ? "Tap to re-record" : "Tap the mic to start"}
              </p>
            )}

            {isRecording && (
              <button
                onClick={stopRecording}
                className="rounded-full border border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
              >
                Stop recording
              </button>
            )}
          </div>

          {/* Editable transcript */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label mb-0" htmlFor="transcript">
                Transcript
                <span className="ml-1.5 font-normal text-slate-400">(editable)</span>
              </label>
              {transcript && (
                <button
                  onClick={() => setTranscript("")}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <textarea
              id="transcript"
              rows={5}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Your words will appear here as you speak. You can also type or paste your order directly."
              className="input resize-none leading-relaxed"
            />
          </div>

          <button
            onClick={() => extract("text")}
            disabled={!transcript.trim()}
            className="btn-primary w-full justify-center py-3.5 text-base disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <SparkleIcon />
            Extract items with AI
          </button>
        </div>
      </Shell>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP: EXTRACTING (loading)
  // ──────────────────────────────────────────────────────────────────────────

  if (step === "extracting") {
    return (
      <Shell>
        <div className="flex min-h-[55vh] flex-col items-center justify-center gap-8 text-center">
          {/* Thumbnail for photo, spinner for voice */}
          {inputMethod === "photo" && photo ? (
            <div className="relative">
              <img
                src={photo.dataUrl}
                alt="Your list"
                className="h-36 w-36 rounded-2xl object-cover opacity-50 shadow-lg"
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-indigo-600/10 backdrop-blur-[3px]">
                <Spinner className="h-10 w-10 text-indigo-600" />
              </div>
            </div>
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-indigo-50 shadow-inner">
              <Spinner className="h-12 w-12 text-indigo-500" />
            </div>
          )}

          <div>
            <p
              key={extractingMsgIdx}
              className="text-lg font-semibold text-slate-900 animate-pulse"
            >
              {EXTRACTING_MESSAGES[extractingMsgIdx]}
            </p>
            <p className="mt-1.5 text-sm text-slate-400">
              Claude is analysing your input — this takes a few seconds
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {EXTRACTING_MESSAGES.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === extractingMsgIdx
                    ? "w-6 bg-indigo-600"
                    : i < extractingMsgIdx
                    ? "w-1.5 bg-indigo-300"
                    : "w-1.5 bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP: REVIEW & EDIT
  // ──────────────────────────────────────────────────────────────────────────

  if (step === "review") {
    const isValid =
      orderTitle.trim() &&
      deadline &&
      items.length > 0 &&
      items.every((i) => i.name.trim());

    const methodBadge =
      inputMethod === "photo"
        ? { label: "Extracted via photo", cls: "bg-violet-100 text-violet-700" }
        : inputMethod === "voice"
        ? { label: "Extracted via voice", cls: "bg-indigo-100 text-indigo-700" }
        : null;

    return (
      <Shell>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <Header
            back={() => {
              setSaveError(null);
              setSubmitAttempted(false);
              if (inputMethod === "manual") setStep("method");
              else setStep(inputMethod ?? "method");
            }}
            title="Review your order"
            subtitle="Edit items below, then confirm and save."
          />
          {methodBadge && (
            <span className={`mt-6 badge ${methodBadge.cls} shrink-0`}>
              {methodBadge.label}
            </span>
          )}
        </div>

        {saveError && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-700">{saveError}</p>
              <p className="mt-1 text-xs text-red-500">
                Ensure the <code className="font-mono">orders</code> and{" "}
                <code className="font-mono">order_items</code> tables exist in
                your Supabase project. See the SQL comment in{" "}
                <code className="font-mono">app/orders/new/page.tsx</code>.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-5">
          {/* Order title + deadline */}
          <div className="card grid gap-5 p-6 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="order-title">
                Order title
              </label>
              <input
                id="order-title"
                type="text"
                required
                placeholder="e.g. Weekly fresh produce"
                value={orderTitle}
                onChange={(e) => setOrderTitle(e.target.value)}
                className={`input ${submitAttempted && !orderTitle.trim() ? "border-red-400 focus:ring-red-400/20 focus:border-red-400" : ""}`}
              />
              {submitAttempted && !orderTitle.trim() && (
                <p className="mt-1 text-xs text-red-500">Required</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="order-deadline">
                Bid deadline
              </label>
              <input
                id="order-deadline"
                type="date"
                required
                value={deadline}
                min={today}
                onChange={(e) => setDeadline(e.target.value)}
                className={`input ${submitAttempted && !deadline ? "border-red-400 focus:ring-red-400/20 focus:border-red-400" : ""}`}
              />
              {submitAttempted && !deadline && (
                <p className="mt-1 text-xs text-red-500">Required</p>
              )}
            </div>
          </div>

          {/* Items table */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">
                Items
                <span className="ml-2 text-sm font-normal text-slate-400">
                  {items.length} item{items.length !== 1 ? "s" : ""}
                </span>
              </h2>
            </div>

            {/* Column headers — desktop only */}
            <div className="hidden sm:grid grid-cols-[1fr_90px_110px_44px] gap-3 border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              <span>Item name</span>
              <span>Qty</span>
              <span>Unit</span>
              <span />
            </div>

            <div className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const nameInvalid = submitAttempted && !item.name.trim();
                return (
                  <div
                    key={item.id}
                    className="flex flex-col sm:grid sm:grid-cols-[1fr_90px_110px_44px] gap-2 sm:gap-3 sm:items-center px-5 py-3"
                  >
                    <input
                      type="text"
                      required
                      placeholder={`Item ${idx + 1}`}
                      value={item.name}
                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                      className={`input ${nameInvalid ? "border-red-400 focus:ring-red-400/20 focus:border-red-400" : ""}`}
                    />
                    <div className="flex gap-2 sm:contents">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                        className="input w-full sm:w-auto text-center"
                      />
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                        className="input w-full sm:w-auto px-2"
                      >
                        {UNITS.map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={items.length === 1}
                        aria-label="Remove item"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add item
              </button>
            </div>
          </div>

          {/* Save as preset */}
          <div className="card p-5">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={saveAsPreset}
                onChange={(e) => setSaveAsPreset(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Save as a preset for quick reordering
              </span>
            </label>
            {saveAsPreset && (
              <div className="mt-3 space-y-2.5">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={useOrderName}
                    onChange={(e) => setUseOrderName(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-600">Use order name as preset name</span>
                </label>
                <input
                  type="text"
                  placeholder="Preset name — e.g. Weekly Produce"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  disabled={useOrderName}
                  className="input disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                />
                <p className="text-xs text-slate-400">
                  This preset will appear on your dashboard and presets page for instant reordering.
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary flex-1 justify-center py-3.5 text-base disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Saving…
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Confirm &amp; Save Order
                </>
              )}
            </button>
            {inputMethod !== "manual" && (
              <button
                onClick={() => { setSaveError(null); setStep(inputMethod ?? "method"); }}
                className="btn-secondary justify-center sm:w-auto"
              >
                ← Re-capture
              </button>
            )}
          </div>

          {submitAttempted && !isValid && (
            <p className="text-center text-sm text-red-500">
              Please fill in all required fields before saving.
            </p>
          )}
        </div>
      </Shell>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP: SUCCESS
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <Shell>
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="card w-full max-w-md px-10 py-14 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg
              className="h-8 w-8 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">Order submitted!</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Your order is now live. Verified suppliers will review it and start
            submitting bids shortly.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link href="/bids" className="btn-primary w-full justify-center py-3">
              View incoming bids
            </Link>
            <Link href="/orders/new" className="btn-secondary w-full justify-center py-3">
              Place another order
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-400 hover:text-slate-700 transition-colors"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">{children}</div>
    </div>
  );
}

interface HeaderProps {
  back: string | (() => void);
  title: string;
  subtitle?: string;
}

function Header({ back, title, subtitle }: HeaderProps) {
  const backEl =
    typeof back === "string" ? (
      <Link
        href={back}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeftIcon />
        Back
      </Link>
    ) : (
      <button
        onClick={back}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeftIcon />
        Back
      </button>
    );
  return (
    <div>
      {backEl}
      <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

interface MethodCardProps {
  onClick: () => void;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
  badge: string;
  badgeCls: string;
  disabled?: boolean;
}

function MethodCard({ onClick, icon, iconBg, title, desc, badge, badgeCls, disabled }: MethodCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="card flex flex-col gap-4 p-7 text-left transition duration-150 hover:shadow-card-hover hover:-translate-y-0.5 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-card"
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg}`}>
        {icon}
      </div>
      <div>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <span className={`badge ${badgeCls}`}>{badge}</span>
        </div>
        <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
      </div>
    </button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function ArrowLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
    </svg>
  );
}
