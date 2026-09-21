/**
 * MiniMax M3 client — a thin wrapper around `@anthropic-ai/sdk` pointed at
 * MiniMax's Anthropic-compatible gateway.
 *
 * MiniMax exposes the same Messages API as Anthropic; only the base URL and
 * the model name change. Per the MiniMax docs:
 *
 *   - base URL:   https://api.minimax.io/anthropic
 *   - model id:   MiniMax-M3   (1M-token context)
 *   - auth:       same `ANTHROPIC_API_KEY` env var (carries the MiniMax key)
 *
 * This module reads the env at call time so deployments can switch between
 * real Anthropic and MiniMax by setting `ANTHROPIC_BASE_URL`.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

export const MINIMAX_BASE_URL = "https://api.minimax.io/anthropic";
export const MINIMAX_MODEL = "MiniMax-M3";

/**
 * Returns true when the current env is configured to route through MiniMax.
 * Detection (in order):
 *   1. Explicit `LLM_PROVIDER=minimax`.
 *   2. `ANTHROPIC_BASE_URL` containing `minimax.io`.
 *   3. `ANTHROPIC_API_KEY` starting with the MiniMax `sk-cp-` prefix.
 */
export function isMiniMaxConfigured(): boolean {
  const explicit = (process.env.LLM_PROVIDER ?? "").toLowerCase();
  if (explicit === "minimax") return true;
  const base = process.env.ANTHROPIC_BASE_URL ?? "";
  if (base.includes("minimax.io")) return true;
  const key = process.env.ANTHROPIC_API_KEY ?? "";
  if (key.startsWith("sk-cp-")) return true;
  return false;
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cachedClient: Anthropic | null = null;
let cachedSignature: string | null = null;

/**
 * Lazy, env-aware Anthropic client. If MiniMax is configured we point it at
 * MiniMax's gateway; otherwise we hit real Anthropic.
 */
export function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const useMiniMax = isMiniMaxConfigured();
  const signature = `${useMiniMax ? "minimax" : "anthropic"}|${apiKey.length}`;
  if (cachedClient && cachedSignature === signature) return cachedClient;

  cachedClient = new Anthropic({
    apiKey,
    ...(useMiniMax ? { baseURL: MINIMAX_BASE_URL } : {}),
  });
  cachedSignature = signature;
  return cachedClient;
}

/** Resolve the model id for the current provider. */
export function resolveModel(defaultModel = "claude-3-5-sonnet-latest"): string {
  return isMiniMaxConfigured() ? MINIMAX_MODEL : defaultModel;
}

/**
 * Convenience: send a non-streaming messages request. Returns the joined
 * text of every text block in the response.
 *
 * Returns null when the LLM is not configured or the call fails — callers
 * should fall back to a deterministic local response.
 */
export async function sendMessage(opts: {
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}): Promise<string | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  try {
    const response = await client.messages.create({
      model: opts.model ?? resolveModel(),
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 1,
      ...(opts.system ? { system: opts.system } : {}),
      messages: opts.messages.map((m) => ({
        role: m.role,
        content: [{ type: "text" as const, text: m.content }],
      })),
    });
    return response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
  } catch (err) {
    console.warn(
      "[minimax] sendMessage failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
