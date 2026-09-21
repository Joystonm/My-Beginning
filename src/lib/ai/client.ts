import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Unified Anthropic client. Picks up MiniMax as the backing model when
 * either `LLM_PROVIDER=minimax` is set or `ANTHROPIC_BASE_URL` points at
 * the MiniMax Anthropic-compatible gateway.
 *
 * Returns null when no API key is configured so callers can degrade
 * gracefully to a deterministic UI state.
 */
export function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.ANTHROPIC_BASE_URL || undefined;
  return new Anthropic({ apiKey, baseURL });
}

/** True if any LLM provider is wired up. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** True if MiniMax is the active backend. */
export function isMinimaxActive(): boolean {
  if (process.env.LLM_PROVIDER === "minimax") return true;
  const baseURL = process.env.ANTHROPIC_BASE_URL ?? "";
  return baseURL.includes("minimax");
}

/**
 * Model id to pass to the Anthropic SDK.
 *
 * - When MiniMax is active, the gateway accepts Anthropic-format requests
 *   but expects the `MiniMax-M3` model name.
 * - Otherwise we use the latest stable Claude Sonnet.
 */
export function getModelId(): string {
  return isMinimaxActive() ? "MiniMax-M3" : "claude-3-5-sonnet-latest";
}
