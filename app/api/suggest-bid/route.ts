import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic();

type OrderItem = {
  name: string;
  quantity: number;
  unit: string;
};

type Order = {
  title: string;
  deadline: string;
  order_items: OrderItem[];
};

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let body: { order: Order };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { order } = body;
  if (!order?.title || !Array.isArray(order?.order_items)) {
    return NextResponse.json({ error: "Missing order data." }, { status: 400 });
  }

  const itemsList = order.order_items
    .map((i) => `- ${i.name}: ${i.quantity} ${i.unit}`)
    .join("\n");

  const prompt = `You are a pricing expert for a food and hospitality supply marketplace in Japan. A restaurant has posted the following procurement order:

Order title: "${order.title}"
Bid deadline: ${order.deadline}
Items requested:
${itemsList}

ALL PRICES ARE IN JAPANESE YEN (JPY, ¥). This is a Japan-only marketplace — do NOT use USD or any other currency.
Rules:
- Return a WHOLE NUMBER integer yen amount. NO decimals, NO cents.
- Use realistic Japanese wholesale market rates (e.g. vegetables ¥200–¥600/kg, seafood ¥1,000–¥6,000/kg, meat ¥800–¥3,000/kg, dry goods ¥300–¥1,500/kg).
- Factor in the quantities requested (bulk discounts for large volumes).
- Include a supplier margin of 15–25%.
- Example: 20 kg of salmon at ¥2,000/kg wholesale + 20% margin = suggestedPrice of 48000.

Respond ONLY with valid JSON in this exact format — no markdown, no code fences, no extra text:
{"suggestedPrice": 48000, "reasoning": "2–3 sentence explanation of the pricing logic in yen, mentioning key cost drivers."}`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const raw =
      message.content[0].type === "text" ? message.content[0].text.trim() : "{}";

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not parse a price suggestion from Claude's response." },
        { status: 422 }
      );
    }

    const result: unknown = JSON.parse(jsonMatch[0]);
    if (
      typeof result !== "object" ||
      result === null ||
      typeof (result as Record<string, unknown>).suggestedPrice !== "number" ||
      typeof (result as Record<string, unknown>).reasoning !== "string"
    ) {
      return NextResponse.json(
        { error: "Unexpected response format from Claude." },
        { status: 422 }
      );
    }

    const r = result as { suggestedPrice: number; reasoning: string };
    return NextResponse.json({ suggestedPrice: Math.round(r.suggestedPrice), reasoning: r.reasoning });
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
