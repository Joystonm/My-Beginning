# Disabling Supabase email confirmation

By default Supabase Auth sends a "Confirm your email address" email after
`signUp`, and the new user can't sign in until they click the link. To
remove that step entirely:

## In the Supabase dashboard

1. Open your project at https://app.supabase.com
2. Go to **Authentication** → **Providers**
3. Click the **Email** provider
4. Toggle **Confirm email** **OFF**
5. Click **Save**

That's it — new signups will be auto-confirmed and the `/api/auth/signup`
route returns a session immediately. The login flow becomes:

- `/api/auth/signup` → creates the user → returns `{ user }`
- Client redirects to `/ancestor` (or `?next=`)

No code changes are required.

## Why this matters for this project

- The unified `/login` page's "Sign up" tab creates accounts via
  `/api/auth/signup`, which calls `supabase.auth.signUp({ email, password, … })`.
- With "Confirm email" ON, the response is `data.user` but no session,
  so the user lands on `/ancestor` without an authenticated cookie and
  is immediately redirected back to `/login`.
- With "Confirm email" OFF, the response includes both `user` and
  `session`, the server cookie is set, and the user can navigate freely.

## Optional: enable email confirmation later

If you ever want to require confirmation again (e.g. for a production
launch where bots could otherwise create accounts):

1. Toggle the setting back ON in the dashboard.
2. Update `LoginView` so users who try to sign in with an unconfirmed
   email see a "Check your inbox to confirm your account" message
   instead of a generic auth error.

The current `LoginView` already surfaces server-supplied error messages,
so the only change needed is a small copy tweak when the error string
matches `"Email not confirmed"`.
