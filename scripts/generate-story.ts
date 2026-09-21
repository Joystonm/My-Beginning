/**
 * Standalone CLI for MiniMax M3 story generation.
 *
 * Usage:
 *   npm run story -- --prompt "A lighthouse keeper receives a radio signal from 1847."
 *   npm run story -- --prompt "..." --stream
 *   npm run story -- --prompt-file prompt.txt
 *   echo "A story prompt" | npm run story -- --stdin
 *
 * Reads `.env.local` from the repo root if present so `ANTHROPIC_API_KEY`
 * and `ANTHROPIC_BASE_URL` are picked up automatically. The script forces
 * the MiniMax gateway so it always uses MiniMax-M3, regardless of what
 * the app is configured to do at runtime.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const ROOT = resolve(__dirname, "..");

const MINIMAX_BASE_URL = "https://api.minimax.io/anthropic";
const MINIMAX_MODEL = "MiniMax-M3";

const STORY_SYSTEM_PROMPT = `You are a vivid, literary short-story writer.
Write with strong imagery, distinct voice, and a clear three-act arc.
Avoid clichés, avoid emoji, avoid markdown. Output plain prose only.`;

interface CliArgs {
  prompt: string;
  stream: boolean;
  maxTokens: number;
  temperature: number;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    prompt: "",
    stream: false,
    maxTokens: 2000,
    temperature: 1,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--prompt" || a === "-p") {
      out.prompt = argv[++i] ?? "";
    } else if (a === "--prompt-file") {
      const p = argv[++i];
      if (p) out.prompt = readFileSync(resolve(ROOT, p), "utf8").trim();
    } else if (a === "--stdin") {
      out.prompt = readFileSync(0, "utf8").trim();
    } else if (a === "--stream" || a === "-s") {
      out.stream = true;
    } else if (a === "--max-tokens") {
      out.maxTokens = parseInt(argv[++i] ?? "2000", 10);
    } else if (a === "--temperature" || a === "-t") {
      out.temperature = parseFloat(argv[++i] ?? "1");
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return out;
}

function printHelp(): void {
  console.log(`generate-story — stream a story from MiniMax M3

Usage:
  npm run story -- --prompt "A prompt" [--stream] [--max-tokens N] [--temperature N]
  npm run story -- --prompt-file path/to/prompt.txt
  npm run story -- --stdin

Env (loaded from .env.local):
  ANTHROPIC_API_KEY   your MiniMax token
  ANTHROPIC_BASE_URL  optional; if set must point at MiniMax
`);
}

async function readStdin(): Promise<string> {
  return new Promise((resolveStdin) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => (buf += chunk));
    process.stdin.on("end", () => resolveStdin(buf.trim()));
    // If nothing is piped, resolve immediately with empty string.
    if (process.stdin.isTTY) resolveStdin("");
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // `--stdin` with no piped input → fall back to argv-based parsing.
  if (!args.prompt) {
    const piped = await readStdin();
    if (piped) args.prompt = piped;
  }

  if (!args.prompt) {
    console.error("Error: no prompt supplied. Use --prompt, --prompt-file, or --stdin.");
    printHelp();
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "Error: ANTHROPIC_API_KEY is not set. Add it to .env.local with your MiniMax token.",
    );
    process.exit(1);
  }

  const client = new Anthropic({
    apiKey,
    baseURL: MINIMAX_BASE_URL,
  });

  console.error(`[generate-story] model=${MINIMAX_MODEL} baseURL=${MINIMAX_BASE_URL}`);
  console.error(`[generate-story] stream=${args.stream} maxTokens=${args.maxTokens} temperature=${args.temperature}`);
  console.error(`[generate-story] prompt (${args.prompt.length} chars): "${args.prompt.slice(0, 80)}${args.prompt.length > 80 ? "…" : ""}"`);
  console.error("\n----- story -----\n");

  if (args.stream) {
    const stream = client.messages.stream({
      model: MINIMAX_MODEL,
      max_tokens: args.maxTokens,
      temperature: args.temperature,
      system: STORY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: [{ type: "text", text: args.prompt }] }],
    });
    for await (const event of stream) {
      // Text deltas carry the streaming characters; the SDK v0.125.0
      // exposes them as `content_block_delta` events with a `text` delta.
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        process.stdout.write(event.delta.text);
      }
    }
    process.stdout.write("\n");
  } else {
    const response = await client.messages.create({
      model: MINIMAX_MODEL,
      max_tokens: args.maxTokens,
      temperature: args.temperature,
      system: STORY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: [{ type: "text", text: args.prompt }] }],
    });
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    process.stdout.write(text + "\n");
  }

  console.error("\n----- done -----");
}

main().catch((err) => {
  console.error("[generate-story] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
