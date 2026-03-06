import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a grocery order extraction assistant for a restaurant supply marketplace.
Extract every food or supply item from the input and return ONLY a valid JSON array — no markdown, no explanation, no code fences.

Format: [{"name": "Item Name", "quantity": 1.0, "unit": "kg"}]

Rules:
- Allowed units: kg, g, L, mL, units, cases, dozen, bunch, bag, box
- If quantity is missing or ambiguous, default to 1
- If unit is missing or ambiguous, use "units"
- Capitalise and normalise item names (e.g. "toms" → "Tomatoes", "chx breast" → "Chicken Breast", "evoo" → "Olive Oil")
- Include every distinct item — do not skip any`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    let message: Anthropic.Message;

    if (body.type === "image") {
      // Strip the data-URL prefix to get raw base64
      const base64 = body.image.replace(/^data:[^;]+;base64,/, "");
      const mediaType = (body.mediaType ?? "image/jpeg") as
        | "image/jpeg"
        | "image/png"
        | "image/gif"
        | "image/webp";

      message = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: "Extract all grocery/supply items from this handwritten list.",
              },
            ],
          },
        ],
      });
    } else {
      if (!body.transcript?.trim()) {
        return NextResponse.json(
          { error: "Transcript is empty." },
          { status: 400 }
        );
      }

      message = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Extract all grocery/supply items from this text:\n\n"${body.transcript}"`,
          },
        ],
      });
    }

    const rawText =
      message.content[0].type === "text"
        ? message.content[0].text.trim()
        : "[]";

    // Robustly pull out the JSON array even if the model wraps it in prose
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Claude could not find any items in the input." },
        { status: 422 }
      );
    }

    const items: unknown = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No items could be extracted — try a clearer photo or description." },
        { status: 422 }
      );
    }

    return NextResponse.json({ items });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error: ${err.message}` },
        { status: err.status ?? 500 }
      );
    }
    const msg = err instanceof Error ? err.message : "Unknown extraction error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
