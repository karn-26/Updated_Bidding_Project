/**
 * POST /api/estimate-delivery-fee
 *
 * Estimates a delivery fee using:
 *   1. Haversine distance between supplier and restaurant coordinates.
 *   2. A configurable per-km rate (see DELIVERY_RATE_PER_KM below).
 *   3. Claude (same model as suggest-bid) to factor in goods volume/weight
 *      and return a rounded, human-readable fee with reasoning.
 *
 * ─── Configuration ──────────────────────────────────────────────────────────
 * DELIVERY_RATE_PER_KM — base rate in JPY per kilometre of road distance.
 * Default: ¥60/km. To change: update the constant below.
 * This is the ONLY place the rate lives.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Inputs (JSON body):
 *   orderItems    { name, quantity, unit }[]   — goods being delivered
 *   supplierLat   number                       — supplier latitude
 *   supplierLng   number                       — supplier longitude
 *   restaurantLat number                       — restaurant latitude
 *   restaurantLng number                       — restaurant longitude
 *
 * Outputs (JSON):
 *   { estimatedFee: number, reasoning: string }
 *
 * No external/paid geocoding API is called at request time.
 * Coordinates are pre-stored at signup (see lib/jp_postal.ts).
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { haversineKm } from "@/lib/jp_postal";

// ─── Configuration constant ──────────────────────────────────────────────────
// Base rate in JPY per kilometre.  Change here to tune across the whole app.
const DELIVERY_RATE_PER_KM = 200; // ¥200 / km
// ─────────────────────────────────────────────────────────────────────────────

const client = new Anthropic();

type OrderItem = { name: string; quantity: number; unit: string };

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let body: {
    orderItems:    OrderItem[];
    supplierLat:   number;
    supplierLng:   number;
    restaurantLat: number;
    restaurantLng: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { orderItems, supplierLat, supplierLng, restaurantLat, restaurantLng } = body;

  if (
    !Array.isArray(orderItems) ||
    typeof supplierLat    !== "number" ||
    typeof supplierLng    !== "number" ||
    typeof restaurantLat  !== "number" ||
    typeof restaurantLng  !== "number"
  ) {
    return NextResponse.json({ error: "Missing or invalid input fields." }, { status: 400 });
  }

  const distanceKm = haversineKm(supplierLat, supplierLng, restaurantLat, restaurantLng);
  const baseRate   = distanceKm * DELIVERY_RATE_PER_KM;

  const itemsList = orderItems
    .map((i) => `- ${i.name}: ${i.quantity} ${i.unit}`)
    .join("\n");

  const prompt = `You are a delivery logistics expert for a Japanese food-supply marketplace.

A supplier needs to deliver the following goods to a restaurant:
${itemsList}

Straight-line distance between supplier and restaurant: ${distanceKm.toFixed(1)} km
Base delivery cost at ¥${DELIVERY_RATE_PER_KM}/km: ¥${Math.round(baseRate)}

ALL FEES ARE IN JAPANESE YEN (JPY, ¥). Return a WHOLE NUMBER integer — NO decimals.
Adjust the fee based on:
- Goods volume and handling difficulty (e.g. many items, heavy/fragile goods = higher fee)
- Typical road distance multiplier for Japan (road distance ≈ 1.3× straight-line)
- Minimum viable fee of ¥500 even for very short distances
- Round to the nearest ¥100
- Example: 8 km straight-line with moderate goods → road distance ≈ 10.4 km → base ¥${DELIVERY_RATE_PER_KM * 10} → estimatedFee 2100

Respond ONLY with valid JSON in this exact format — no markdown, no code fences, no extra text:
{"estimatedFee": 2100, "reasoning": "2–3 sentence explanation in yen, mentioning the distance and key cost drivers."}`;

  try {
    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages:   [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not parse a fee estimate from Claude's response." },
        { status: 422 }
      );
    }

    const result: unknown = JSON.parse(jsonMatch[0]);
    if (
      typeof result !== "object" ||
      result === null ||
      typeof (result as Record<string, unknown>).estimatedFee !== "number" ||
      typeof (result as Record<string, unknown>).reasoning    !== "string"
    ) {
      return NextResponse.json(
        { error: "Unexpected response format from Claude." },
        { status: 422 }
      );
    }

    const r = result as { estimatedFee: number; reasoning: string };
    return NextResponse.json({ estimatedFee: Math.round(r.estimatedFee), reasoning: r.reasoning, distanceKm: parseFloat(distanceKm.toFixed(1)) });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error: ${err.message}` },
        { status: err.status ?? 500 }
      );
    }
    const msg = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
