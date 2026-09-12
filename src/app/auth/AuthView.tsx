"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Eyebrow,
  Input,
  Label,
  Panel,
  PanelBody,
  PanelHeader,
  StateBlock,
} from "@/components/design-system";
import { isSupabaseConfigured } from "@/lib/supabase";

export function AuthView({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isSupabaseConfigured()) {
    return (
      <div className="py-16">
        <StateBlock
          eyebrow="Authentication"
          title="Server-side auth is not configured"
          description={
            <>
              This deployment does not have a Supabase project. You can still
              explore the Ancestor engine and create Universes (they&apos;ll
              be stored in your browser). To enable cross-device sync and
              server-side storage, set NEXT_PUBLIC_SUPABASE_URL and
              NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local.
            </>
          }
          action={
            <Link
              href="/ancestor"
              className="inline-flex items-center gap-2 rounded-[4px] bg-ink-primary text-ink-inverse text-sm h-8 px-3 hover:bg-[#1c1c1c]"
            >
              Try the Ancestor experience →
            </Link>
          }
        />
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const endpoint = mode === "signin" ? "/api/auth/login" : "/api/auth/signup";
      const body: Record<string, string> = { email, password };
      if (mode === "signup" && displayName) body.displayName = displayName;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { user?: unknown; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Authentication failed.");
        return;
      }
      router.push("/ancestor");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="py-14 sm:py-20 max-w-md mx-auto">
      <Eyebrow>Account</Eyebrow>
      <h1 className="heading-display text-3xl mt-2">
        {mode === "signin" ? "Sign in" : "Create your account"}
      </h1>
      <p className="text-sm text-ink-secondary mt-2">
        {mode === "signin"
          ? "Access your universes across devices."
          : "Universes, preferences and saved queries sync to your account."}
      </p>

      <div className="mt-8">
        <Panel>
          <PanelHeader
            eyebrow={mode === "signin" ? "Sign in" : "Sign up"}
            title={mode === "signin" ? "Welcome back" : "A few details"}
          />
          <PanelBody>
            <form className="space-y-4" onSubmit={submit}>
              {mode === "signup" && (
                <div>
                  <Label>Display name</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="What should we call you?"
                  />
                </div>
              )}
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "At least 8 characters" : ""}
                />
              </div>
              {error && (
                <p className="text-sm text-signal-negative">{error}</p>
              )}
              <div className="flex items-center justify-between pt-2">
                <Link
                  href={mode === "signin" ? "/auth/sign-up" : "/auth/sign-in"}
                  className="text-sm text-ink-secondary hover:text-ink-primary"
                >
                  {mode === "signin"
                    ? "Need an account? Sign up"
                    : "Already have one? Sign in"}
                </Link>
                <Button type="submit" loading={busy} disabled={!email || !password}>
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </div>
            </form>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}