/**
 * My Beginning chatbot endpoint.
 *
 * Streams a free-form answer to general questions about cryptocurrencies —
 * history, founders, technology, concepts, the family-tree model.
 *
 * Intentionally NOT wired to live data: there is no tool, no top-50
 * listings injection, and the system prompt forbids guessing prices. The
 * chatbot is for explanations and discussion, not real-time quotes.
 *
 * Wire format: Server-Sent Events. Each event is a JSON object with
 *   {type: "meta", model, provider}
 *   {type: "text", text: "..."}
 *   {type: "error", message: "..."}
 * The stream ends with `[DONE]`.
 */

import { NextRequest } from "next/server";
import { getAnthropicClient, getModelId, isAiConfigured, isMinimaxActive } from "@/lib/ai/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Body {
  messages: ChatMessage[];
}

const SYSTEM_PROMPT = `You are the My Beginning assistant — a helpful guide for exploring cryptocurrency history and concepts.

My Beginning traces the family tree of cryptocurrencies: code forks (Litecoin forked Bitcoin), platform tokens (USDT and SHIB on Ethereum), wrapped assets (WBTC), and inspiration chains. It also surfaces a "lineage drift" — 30-day performance across every descendant of a coin.

You do NOT have access to live prices or real-time market data. If the user asks for current prices, recent performance rankings, today's movers, or anything that requires up-to-the-minute numbers, decline honestly and suggest they check a live source like CoinMarketCap or CoinGecko. Never invent a price, percentage, or rank.

Answer what you do know, from your training:
- Crypto history — when coins launched, who founded them, what problem they solved
- Concepts — forks (code forks vs inspiration chains), platform tokens, wrapped assets, mining, consensus
- Lineage facts — relationships between coins that are well-documented
- Anything else the user asks, answered normally

Keep responses short — 1-3 sentences for simple questions, longer only when the topic needs it. Plain prose. Cite ticker symbols (BTC, ETH) when relevant. When you're unsure of a fact, say so rather than guessing.`;

export async function POST(req: NextRequest) {
  if (!isAiConfigured()) {
    return new Response(
      JSON.stringify({
        error:
          "AI is not configured. Set ANTHROPIC_API_KEY (and ANTHROPIC_BASE_URL for MiniMax) to enable the chatbot.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" } },
    );
  }

  const messages = (body.messages ?? []).filter(
    (m): m is ChatMessage =>
      (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0,
  );
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const client = getAnthropicClient();
        if (!client) {
          send({ type: "error", message: "AI client unavailable." });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        const model = getModelId();
        send({ type: "meta", model, provider: isMinimaxActive() ? "minimax" : "anthropic" });

        // One-shot streaming response — no tools, no live data layer.
        const finalStream = client.messages.stream({
          model,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        finalStream.on("text", (text: string) => {
          send({ type: "text", text });
        });

        await finalStream.done();

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Chat failed.",
        });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
