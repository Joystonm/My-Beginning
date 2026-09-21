"use client";

import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Eyebrow,
  Input,
  Panel,
  PanelBody,
  PanelHeader,
} from "@/components/design-system";

type Role = "user" | "assistant";

interface ChatMessage {
  role: Role;
  content: string;
  /** Tools the assistant invoked during this turn, for transparency. */
  tools?: { tool: string; input: Record<string, unknown> }[];
}

const SUGGESTED = [
  "Tell me about Ethereum's biggest descendants",
  "What's the difference between a code fork and an inspiration chain?",
  "Who founded Dogecoin and why?",
  "What does \"platform token\" mean in My Beginning?",
];

export function AiTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [provider, setProvider] = useState<"anthropic" | "minimax" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Conversations are intentionally ephemeral — nothing is read from or
  // written to localStorage. We do clear any leftover history from older
  // builds so users upgrading don't see stale messages.
  useEffect(() => {
    try {
      window.localStorage.removeItem("wima.lab.chat.v1");
    } catch {
      /* ignore */
    }
  }, []);

  // Auto-scroll to the bottom on new content.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  async function send(promptOverride?: string) {
    const prompt = (promptOverride ?? input).trim();
    if (!prompt || streaming) return;

    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: prompt },
      { role: "assistant", content: "", tools: [] },
    ];
    setMessages(next);
    setInput("");
    setError(null);
    setStreaming(true);

    // Hand the history (without the empty placeholder) to the server.
    const history = next.filter((m) => !(m.role === "assistant" && m.content === ""));

    try {
      const res = await fetch("/api/lab/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const json = await safeJson(res);
        throw new Error(json.error ?? `Request failed (${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (delimited by blank lines).
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          for (const line of rawEvent.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const event = JSON.parse(data) as
                | { type: "text"; text: string }
                | { type: "tool"; tool: string; input: Record<string, unknown> }
                | { type: "meta"; model: string; provider: "anthropic" | "minimax" }
                | { type: "error"; message: string };
              applyEvent(event, setMessages, setModel, setProvider, setError);
            } catch {
              /* malformed line — skip */
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed.");
      // Drop the empty assistant placeholder.
      setMessages((prev) => prev.filter((m) => m.content !== ""));
    } finally {
      setStreaming(false);
    }
  }

  function clear() {
    if (!window.confirm("Clear the conversation?")) return;
    setMessages([]);
    setError(null);
  }

  const isEmpty = messages.length === 0;

  return (
    <Panel>
      <PanelHeader
        eyebrow="Ask in Lab"
        title="Ask about crypto"
        description="General questions about cryptocurrencies — history, founders, technology, family trees. This assistant does not have access to live prices."
        actions={
          <>
            {provider && (
              <Badge tone={provider === "minimax" ? "accent" : "muted"}>
                {provider === "minimax" ? "MiniMax M3" : model ?? "AI"}
              </Badge>
            )}
            {messages.length > 0 && (
              <button
                onClick={clear}
                className="text-sm text-ink-tertiary hover:text-signal-negative transition-colors duration-180"
                disabled={streaming}
              >
                Clear
              </button>
            )}
          </>
        }
      />
      <PanelBody className="!p-0">
        <div
          ref={scrollRef}
          className="h-[480px] overflow-y-auto px-5 py-4 space-y-4"
        >
          {isEmpty && (
            <EmptyState onPick={(q) => send(q)} />
          )}
          {messages.map((m, i) => (
            <Bubble
              key={i}
              message={m}
              isStreaming={streaming && i === messages.length - 1 && m.role === "assistant"}
            />
          ))}
        </div>

        {error && (
          <div className="px-5 py-3 text-sm text-signal-negative border-t border-line-subtle bg-[#F8E6E2]/40">
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-center gap-2 px-5 py-3 border-t border-line-subtle bg-canvas"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about any coin, price, or family tree…"
            disabled={streaming}
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim() || streaming} loading={streaming}>
            Send
          </Button>
        </form>
      </PanelBody>
    </Panel>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <Eyebrow>Try one of these</Eyebrow>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
        {SUGGESTED.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="text-left text-sm px-4 py-3 rounded-[6px] border border-line bg-canvas hover:bg-canvas-sunken hover:border-line-strong transition-colors duration-180"
          >
            {q}
          </button>
        ))}
      </div>
      <p className="mt-6 text-xs text-ink-tertiary max-w-md">
        The chatbot answers from general knowledge only — no live prices,
        no real-time rankings. For family-tree data and live prices, use
        the rest of My Beginning.
      </p>
    </div>
  );
}

function Bubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-[8px] bg-accent text-ink-inverse px-4 py-2.5 text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="max-w-[85%] rounded-[8px] bg-canvas-sunken border border-line-subtle px-4 py-2.5 text-sm text-ink-primary leading-relaxed whitespace-pre-wrap">
        {message.content}
        {isStreaming && message.content === "" && (
          <span className="inline-flex gap-1 text-ink-tertiary">
            <Dot delay={0} />
            <Dot delay={150} />
            <Dot delay={300} />
          </span>
        )}
        {isStreaming && message.content !== "" && (
          <span className="inline-block w-1.5 h-3.5 bg-ink-primary ml-0.5 align-middle animate-pulse-soft" />
        )}
      </div>
      {message.tools && message.tools.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          {message.tools.map((t, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-2xs uppercase tracking-[0.08em] text-ink-tertiary font-mono"
            >
              <span className="h-1 w-1 rounded-full bg-accent" />
              {t.tool}({Object.values(t.input).join(", ")})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-ink-tertiary animate-pulse-soft"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

function applyEvent(
  event:
    | { type: "text"; text: string }
    | { type: "tool"; tool: string; input: Record<string, unknown> }
    | { type: "meta"; model: string; provider: "anthropic" | "minimax" }
    | { type: "error"; message: string },
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setModel: (m: string) => void,
  setProvider: (p: "anthropic" | "minimax") => void,
  setError: (e: string) => void,
) {
  if (event.type === "text") {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === "assistant") {
        next[next.length - 1] = { ...last, content: last.content + event.text };
      }
      return next;
    });
  } else if (event.type === "tool") {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === "assistant") {
        const tools = [...(last.tools ?? []), { tool: event.tool, input: event.input }];
        next[next.length - 1] = { ...last, tools };
      }
      return next;
    });
  } else if (event.type === "meta") {
    setModel(event.model);
    setProvider(event.provider);
  } else if (event.type === "error") {
    setError(event.message);
  }
}

async function safeJson(res: Response): Promise<{ error?: string }> {
  try {
    return (await res.json()) as { error?: string };
  } catch {
    return {};
  }
}
