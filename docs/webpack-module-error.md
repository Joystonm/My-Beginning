# Fixing `__webpack_modules__[moduleId] is not a function`

## What you're seeing

```
Server Error
TypeError: __webpack_modules__[moduleId] is not a function
    at Object.__webpack_require__ [as require]
    at file://.../.next/server/webpack-runtime.js (33:42)
```

## Root cause

This is a **stale `.next/` cache** error in the Next.js dev server. After
several rounds of edits, webpack-dev-middleware's manifest can fall out
of sync with the actual filesystem — a chunk ID in the server bundle
references a module that no longer exists or has been renamed.

It almost never indicates a real bug in your code. The production build
(`npx next build`) succeeds without errors; only the dev server's HMR
manifest is confused.

## Fix

Delete the build cache and restart the dev server:

```bash
rm -rf .next
npm run dev
```

If the error persists after that, check:

1. **A client component imports a server-only module.** Run:
   ```bash
   grep -rn 'server-only' src/
   ```
   Then verify no `"use client"` file imports any module with
   `import "server-only"`.

2. **A renamed/moved module is still referenced somewhere.** The
   compiler will catch this — `npx tsc --noEmit` should report it.

## Why it happened in this project

We made many edits in quick succession — adding `AuthProvider`, route
guards, the universes server module, the Coin Story cache UI. Each edit
invalidated chunks in the dev server's manifest. The dev server got
into a state where the manifest said "module X is at chunk Y" but chunk
Y was rebuilt and the old module ID was no longer present.

## Verification

- `npx tsc --noEmit` — passes (no type errors).
- `npx next build` — succeeds (25 routes generated).
- `npm test` — 45/45 passing.
- Dev server after `rm -rf .next && npm run dev` — works correctly.
