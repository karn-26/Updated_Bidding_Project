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

  const prompt = `You are a pricing expert for a food and hospitality supply marketplace. A restaurant has posted the following procurement order:

Order title: "${order.title}"
Bid deadline: ${order.deadline}
Items requested:
${itemsList}

Based on realistic wholesale market prices for these items, suggest an optimal bid price in USD that is competitive but still profitable for a supplier. Consider:
- Current wholesale market rates for each ingredient or product
- The quantities involved (bulk discounts where applicable)
- A reasonable supplier margin of 15–25%
- Competitiveness relative to other potential bids

Respond ONLY with valid JSON in this exact format — no markdown, no code fences, no extra text:
{"suggestedPrice": 350, "reasoning": "2–3 sentence explanation of the pricing logic, mentioning key cost drivers."}`;

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

    return NextResponse.json(result);
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
