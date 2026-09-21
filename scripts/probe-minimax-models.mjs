/**
 * Find the correct model id on the user's MiniMax gateway.
 *
 * Reads ANTHROPIC_BASE_URL from shell env (NOT --env-file, because shell
 * overrides file). Then POSTs a 1-token request to /v1/messages with each
 * candidate model id and prints the response. Any candidate that returns
 * an error other than "model not found" is the real one.
 *
 * Run:
 *   node --env-file=.env.local scripts/probe-minimax-models.mjs
 */

const apiKey = process.env.ANTHROPIC_API_KEY;
const baseURL = process.env.ANTHROPIC_BASE_URL || "https://api.minimax.io/anthropic";

if (!apiKey) {
  console.error("ANTHROPIC_API_KEY not set.");
  process.exit(1);
}

console.log(`Base URL: ${baseURL}`);
console.log(`Auth:     x-api-key (Anthropic-style)`);
console.log();

const CANDIDATES = [
  "MiniMax-M3",
  "MiniMax",
  "MiniMax/M3",
  "MiniMax-MiniMax-M3",
  "claude-3-5-sonnet-latest",
  "claude-3-5-sonnet-20241022",
  "claude-sonnet-4-5",
  "gpt-4o",
  "gpt-4o-mini",
];

for (const model of CANDIDATES) {
  const res = await fetch(`${baseURL.replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    }),
  });
  const text = await res.text();
  let snippet;
  try {
    const obj = JSON.parse(text);
    snippet = obj.error?.message ?? obj.message ?? JSON.stringify(obj).slice(0, 200);
  } catch {
    snippet = text.slice(0, 200);
  }
  console.log(`[${res.status}] model=${model}`);
  console.log(`        ${snippet}`);
}
