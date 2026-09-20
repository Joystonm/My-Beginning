"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { useAuth } from "@/components/auth";
import { sanitizeNext } from "@/lib/auth/redirect";

type Mode = "signin" | "signup";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginView({ initialMode }: { initialMode?: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeNext(searchParams.get("next"));
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode ?? "signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
              This deployment does not have a Supabase project. Sign in and
              account creation are disabled. Set NEXT_PUBLIC_SUPABASE_URL and
              NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local to enable
              authentication.
            </>
          }
        />
      </div>
    );
  }

  function switchMode(next: Mode) {
    setError(null);
    setMode(next);
    // Clear confirm-password so users don't carry stale state.
    setConfirm("");
  }

  function validate(): string | null {
    if (!email) return "Email is required.";
    if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
    if (!password) return "Password is required.";
    if (mode === "signup") {
      if (password.length < 8) return "Password must be at least 8 characters.";
      if (password !== confirm) return "Passwords do not match.";
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "signin"
          ? await signIn(email, password)
          : await signUp(email, password, displayName.trim() || undefined);
      if (!result.ok) {
        setError(result.error ?? "Authentication failed.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setBusy(false);
    }
  }

  const isSignin = mode === "signin";
  const submitLabel = isSignin ? "Sign in" : "Create account";
  const canSubmit =
    !busy && email.length > 0 && password.length > 0 &&
    (isSignin || (password.length >= 8 && password === confirm));

  return (
    <div className="py-14 sm:py-20 max-w-md mx-auto">
      <Eyebrow>Account</Eyebrow>
      <h1 className="heading-display text-3xl mt-2">
        {isSignin ? "Welcome back" : "Create your account"}
      </h1>
      <p className="text-sm text-ink-secondary mt-2">
        {isSignin
          ? "Access your universes and saved queries across devices."
          : "Universes, preferences and saved queries sync to your account."}
      </p>

      <div className="mt-8">
        <Panel>
          <PanelHeader
            eyebrow={isSignin ? "Sign in" : "Sign up"}
            title={isSignin ? "Sign in to continue" : "A few details"}
          />
          <PanelBody>
            {/* Mode toggle */}
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="flex rounded-[4px] border border-line bg-canvas-sunken/40 p-0.5 mb-5"
            >
              {(["signin", "signup"] as const).map((m) => {
                const active = mode === m;
                return (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={active}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={
                      "flex-1 h-8 rounded-[3px] text-sm font-medium transition-colors duration-180 " +
                      (active
                        ? "bg-canvas text-ink-primary shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
                        : "text-ink-secondary hover:text-ink-primary")
                    }
                  >
                    {m === "signin" ? "Log in" : "Sign up"}
                  </button>
                );
              })}
            </div>

            <form className="space-y-4" onSubmit={submit} noValidate>
              {!isSignin && (
                <div>
                  <Label>Display name</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="What should we call you?"
                    autoComplete="name"
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
                  autoComplete="email"
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignin ? "Your password" : "At least 8 characters"}
                  autoComplete={isSignin ? "current-password" : "new-password"}
                />
              </div>
              {!isSignin && (
                <div>
                  <Label>Confirm password</Label>
                  <Input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                  />
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="text-sm text-signal-negative"
                >
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() =>
                    switchMode(isSignin ? "signup" : "signin")
                  }
                  className="text-sm text-ink-secondary hover:text-ink-primary"
                >
                  {isSignin
                    ? "Need an account? Sign up"
                    : "Already have one? Log in"}
                </button>
                <Button type="submit" loading={busy} disabled={!canSubmit}>
                  {submitLabel}
                </Button>
              </div>
            </form>

            <p className="mt-5 text-2xs text-ink-tertiary leading-relaxed">
              Your account is protected by Supabase Auth. Sessions are stored
              in secure HTTP-only cookies.{" "}
              <Link
                href="/"
                className="underline decoration-line hover:text-ink-secondary"
              >
                Back to home
              </Link>
            </p>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
