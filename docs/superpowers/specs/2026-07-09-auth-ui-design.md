# Login / Register / Logout UI — Design Spec

## Overview

The backend for email/password auth, forgot/reset-password, and Drive-connect is fully specified in `docs/superpowers/plans/2026-07-09-email-auth.md` (as of this writing, that plan is written but not yet implemented). This spec covers the UI that calls those routes, modeled on the attached ShotPik reference screenshot, adapted to this app's actual decisions (no reCAPTCHA, no email verification, Google + email/password side by side).

**This is a UI-only spec.** It assumes the backend routes from the email-auth plan exist exactly as specified there. It requires exactly one small addition to that plan's scope, noted explicitly below (Dependency section) — everything else here is pages/components only.

## Screens

### `/login`

Matches the reference screenshot's structure:
1. Title: "Sign in" (or the app's chosen product name once one exists — see the open question already logged in `2026-07-09-ui-architecture-adr.md`).
2. "Don't have an account? Sign up" — links to `/register`.
3. "Sign in with Google" button — full width, white/neutral background, Google logo, calls NextAuth's `signIn('google')`.
4. A divider: "Or use email".
5. Email field, Password field.
6. "Forgot password?" link — links to `/forgot-password`.
7. Submit button ("Sign in") — calls NextAuth's `signIn('credentials', { email, password, redirect: false })`; on failure, shows an inline error (see Error Handling); on success, redirects to `/albums`.

**No reCAPTCHA widget.** The reference screenshot has one, but the backend spec explicitly decided against implementing reCAPTCHA verification — rendering the checkbox with no real verification behind it would be the same "feature that implies it works but doesn't" problem already found and fixed once in this codebase (`CreateAlbumForm`'s inert settings fields). Omit it entirely rather than fake it.

### `/register`

Same shell as `/login`:
1. Title: "Create account".
2. "Already have an account? Sign in" — links to `/login`.
3. "Sign in with Google" button — same as login (registering via Google is just signing in via Google; the backend already upserts on first login).
4. Divider: "Or use email".
5. Name field (optional), Email field, Password field.
6. Submit button ("Create account") — calls `POST /api/auth/register`. On success, immediately calls `signIn('credentials', { email, password, redirect: false })` to establish a session (registering shouldn't require a second manual login), then redirects to `/albums`. On failure (409 duplicate email, 400 short password), shows the inline error.

### `/forgot-password`

Minimal single-purpose screen:
1. Title: "Reset your password".
2. Email field.
3. Submit button — calls `POST /api/auth/forgot-password`. This route always returns `200` regardless of whether the email exists (by design, to prevent email enumeration) — so the UI always shows the same success state after submit: "If an account exists for that email, we've sent a reset link." Never show a different message for "email not found," since the backend deliberately doesn't distinguish this — a UI that reveals the distinction anyway would defeat the backend's anti-enumeration design.
4. A link back to `/login`.

### `/reset-password?token=...`

1. Title: "Set a new password".
2. New password field, confirm password field (client-side check that they match before submitting — the backend doesn't need a confirm field, this is purely a UX guard).
3. Submit button — calls `POST /api/auth/reset-password` with `{ token, newPassword }` (the `token` comes from the URL query param, not user-entered). On success, show a confirmation and a link to `/login` (do not auto-sign-in here — resetting a password is a good moment to require a fresh, deliberate sign-in). On failure (expired/used/invalid token), show the inline error with a link back to `/forgot-password` to request a new one.

### Logout

Not a separate page. A "Log out" action in the existing `TopNav` component's user menu (wherever the signed-in user's name/avatar already renders — `TopNav` already exists from the dashboard-redesign work), calling NextAuth's `signOut({ callbackUrl: '/login' })`.

### Drive-connect prompt

Not a new page — a banner/notice shown on `/albums` (the dashboard) when the signed-in user has no connected Drive (i.e., `POST /api/albums` has been returning the "Connect your Google Drive" `400` — the dashboard already knows this because album creation fails with that specific message, or the page can check for it server-side by reading the session user's `encryptedRefreshToken` presence, which is a page-level data concern, not this spec's to solve — whoever implements this UI should query that flag the same way `PhotographerGallery`'s server page already queries other album-owner data). The banner reads something like "Connect your Google Drive to start creating albums" with a button/link to `GET /api/drive/connect` (a plain link is sufficient — that route does a server-side redirect to Google's consent screen, no client-side JS needed to trigger it).

## Shared Visual & Interaction Rules

Learn from the same mistake already made once on this project (see the "Visual & Interaction Correctness Requirements" section added to `2026-07-09-photo-action-ui-design.md` after its first broken implementation) — be explicit up front instead of leaving it to be discovered as a bug later:

- All four auth screens (`/login`, `/register`, `/forgot-password`, `/reset-password`) share one visual shell: a centered card on a plain background, matching the reference screenshot's layout — title, subtitle/switch-link, form fields, primary submit button, secondary links. Build this as one shared layout/component, not four independently-styled pages, so they stay visually consistent by construction.
- Every submit button has three distinct visible states: default, `disabled` + loading label while the request is in flight (matching this codebase's established `submitting ? 'Creating…' : 'Create account'`-style pattern), and re-enabled after a response. A user must never be able to double-submit by clicking twice before the first request resolves.
- Every error is shown inline, near the form, with `role="alert"` — matching this codebase's established error convention exactly (see any existing form component, e.g. `CreateAlbumForm.tsx`, for the pattern to copy). Never a browser `alert()`, never a silent failure.
- Password fields use `type="password"` with the browser's native show/hide affordance (native `autocomplete` attributes: `email` for the email field, `new-password` for register/reset, `current-password` for login) — no custom show/hide toggle needed unless a specific request adds one later.
- Field-level validation (empty email, password too short) can show client-side before submitting, but the authoritative check is always the backend's response — never let a client-side check alone claim success.

## Dependency on the Backend Plan (one required addition)

`docs/superpowers/plans/2026-07-09-email-auth.md`'s Task 3 (wiring `CredentialsProvider` into NextAuth) needs one small addition beyond what's currently written there: set `pages: { signIn: '/login' }` in `authOptions` (`src/lib/auth.ts`), so NextAuth routes unauthenticated visitors to this custom page instead of its own built-in default sign-in screen. This is a one-line config addition to an existing task in that plan, not a new task — whoever implements that plan should add it, and whoever implements this UI spec should confirm it's there before wiring up `/login`, since without it NextAuth's default (unstyled) page would still be reachable at `/api/auth/signin` and could confuse users landing there instead of `/login`.

## Testing

Standard component/page tests following this codebase's existing conventions (see any `tests/components/*.test.tsx` for the pattern): each form renders its fields, calls the right endpoint with the right body on submit, shows the loading state while pending, shows the inline `role="alert"` error on failure, and navigates/redirects correctly on success. The `/forgot-password` screen's test should specifically assert the SAME success message renders regardless of whether the mocked response implies the email existed or not (there's no way to tell from the response either way, by design — the test should reflect that by never branching on it).

## Out of Scope

- reCAPTCHA (explicit decision, see `2026-07-09-email-auth-design.md`).
- Email verification at registration (same source).
- Any change to the backend routes themselves — this spec only consumes them as already specified.
- Password-strength meters, social providers beyond Google, "remember me" checkboxes — none of these were requested; don't add them speculatively.
