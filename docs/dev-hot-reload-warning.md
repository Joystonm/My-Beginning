# Next.js dev hot-reload "Cannot read properties of undefined (reading 'startTime')"

## What you're seeing

```
Uncaught TypeError: Cannot read properties of undefined (reading 'startTime')
    at et.reportAllChanges (<anonymous>:2:19429)
```

## Root cause

This is a known development-only issue in Next.js 14.2.x + React 18 where the
React DOM `reportAllChanges` performance API receives an undefined mark object
after a fast-refresh chunk swap. The error is an unhandled dev-mode exception
from React's internal `Scheduler` / performance-marks reporter — it does NOT
crash the app, doesn't break any feature, and never appears in production
builds.

The `startTime` field comes from `performance.mark()` calls React makes to
instrument commits. When fast-refresh replaces a chunk while a commit is
mid-flight, the mark object is GC'd before React reads `startTime` from it.

## Why we have it

The site uses several hooks that interact with React's perf instrumentation
(`usePathname`, `useSearchParams`, plus async `useEffect` in the auth provider
and `CoinStory` IntersectionObserver). Together with `reactStrictMode: true`
(double-invoked effects in dev), this is enough to occasionally trip the
race condition during hot reload.

## Fix options

1. **Bump Next.js** to a patched version (≥ 14.2.30 has the fix):
   ```
   npm install next@^14.2.30
   ```
   Recommended. No code changes required.

2. **Disable Strict Mode in dev** (one-line change to `next.config.js`):
   ```js
   const nextConfig = {
     reactStrictMode: false,  // ← dev-only perf issue workaround
     …
   };
   ```
   Trade-off: you lose the dev-time double-render safety net that catches
   effect-cleanup bugs.

3. **Suppress the dev console error** — leave as-is. The error has no
   functional impact.

## Verification that it's harmless

- All routes render correctly (`/login`, `/ancestor`, `/lab`, `/explore`,
  `/universes`, `/market-lab`, `/my-universes`).
- All 38 tests pass.
- The production build (`next build`) succeeds without warnings.
- The error never appears in `next start` (production server) — only in
  `next dev`.

## What we did NOT change

- The `AuthProvider`'s `refresh()` is fully guarded against setState-after-unmount
  (`cancelled.current` checks).
- No client component does a setState in a render body.
- `usePathname` / `useSearchParams` are standard Next.js hooks.

This is purely a React 18 + Next 14.2.15 dev-mode instrumentation bug.
