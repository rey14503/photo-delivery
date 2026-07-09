# Email/Password Auth + Drive Connect — Design Spec

## Overview

Today, the only way to sign in is Google OAuth, which bundles two things into one grant: identity (who is this user) and Drive access (the `drive.file` scope, needed to create/manage albums). This spec adds an email/password login and registration path, modeled on ShotPik's login screen, alongside the existing Google option — not replacing it. Because email/password sign-in carries no Drive grant, it also adds a separate "connect your Google Drive" flow so a photographer who registered with email/password can still create albums once they explicitly connect Drive.

**Scope note:** this spec is backend-only. `CreateAlbumForm.tsx`, `CreateAlbumModal.tsx`, and any login/register/forgot-password UI are owned by a separate, concurrently-active effort and are not touched here. reCAPTCHA is explicitly out of scope — the ShotPik reference screenshot shows it, but no bot-verification is implemented in this pass. Email verification at registration time is not required — an account is usable immediately after registering.

## Decisions

- **Registration is open** — anyone who submits the form gets a `PHOTOGRAPHER` account immediately, same default role Google sign-in already assigns to new users. No admin approval step.
- **Forgot-password requires sending an email** — this reverses the project's earlier "no email sending" decision, scoped narrowly to this one flow. [Resend](https://resend.com) is the provider; a `RESEND_API_KEY` environment variable is required (not yet present — must be added to `.env`/`.env.local` before this plan's routes can be exercised for real, same as every other external credential this project already depends on).
- **Drive connection is separate from login**, not bundled — an email/password user must explicitly connect Drive via its own flow before creating an album. Google sign-in keeps its current bundled behavior unchanged (identity + Drive in one grant).

## Data Model

```prisma
model User {
  // ...existing fields unchanged...
  passwordHash String?
  resetTokens  PasswordResetToken[]
}

model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}
```

`passwordHash` is nullable — Google-only users never get one. The raw reset token is never persisted, only its hash (`sha256`, via Node's `crypto` — this doesn't need bcrypt's slow hashing since it's a high-entropy random token, not a user-chosen password; a fast, deterministic hash keyed for lookup is correct here, matching how many reset-token implementations work).

## Auth Changes (`src/lib/auth.ts`)

Add a `CredentialsProvider` alongside the existing `GoogleProvider`. Its `authorize(credentials)` looks up the `User` by email, rejects if no `passwordHash` is set (a Google-only account trying to use the password form) or the password doesn't match (`verifyPassword`, already exists from Plan 3), and otherwise returns `{ id, email, name, role }` — the existing `jwt` callback already copies `id`/`role` from whatever `user` object either provider returns onto the token, so no callback changes are needed; both providers converge on the same session shape unchanged.

## New Routes

- **`POST /api/auth/register`** — body `{ email, password, name? }`. Rejects a duplicate email (`409`) or a password under 8 characters (`400`). On success, hashes the password (`hashPassword`, existing), creates a `User` with `role: 'PHOTOGRAPHER'` and `encryptedRefreshToken: null`, and returns the created user's `id`/`email`/`name` (never the hash). Does not establish a session — signing in afterward is a separate client-side `next-auth` call, owned by the UI effort.
- **`POST /api/auth/forgot-password`** — body `{ email }`. Always returns `200` regardless of whether the email exists (prevents email enumeration). If it does exist and has a `passwordHash` set, generates a random token (`crypto.randomBytes(32).toString('hex')`), stores its hash + a 1-hour expiry as a `PasswordResetToken` row, and emails the raw token (embedded in a reset link) via Resend. A Google-only account (no `passwordHash`) is treated the same as a nonexistent one — no email sent, still `200` — so this endpoint never confirms account existence or auth method either way.
- **`POST /api/auth/reset-password`** — body `{ token, newPassword }`. Hashes the incoming token the same way, looks up a matching, unexpired, unused `PasswordResetToken`; `400` if none matches. On success, updates the user's `passwordHash` and marks the token `usedAt` (a token is single-use).
- **`GET /api/drive/connect`** — requires an active session (`401` otherwise). Redirects (`302`) to Google's OAuth consent screen, requesting only the `drive.file` scope with `access_type=offline&prompt=consent` (same as the existing NextAuth Google provider's params), so a returning refresh token is guaranteed.
- **`GET /api/drive/connect/callback`** — receives Google's `code` query param, exchanges it for tokens, encrypts the refresh token (`encrypt`, existing from Plan 1), and updates the **currently signed-in session's** `User.encryptedRefreshToken` — never creates a new `User` row, unlike the Google sign-in flow. Requires an active session; `401` if none. Redirects back to the app (e.g. `/albums`) on success.

## Album-Creation Gate

Both the existing `POST /api/albums` and the pending Drive-link-based rewrite (`docs/superpowers/plans/2026-07-09-drive-link-album-creation.md`, not yet executed — this spec's plan should check whether that one has landed first and adapt, since they touch the same route) must check `user.encryptedRefreshToken` before calling `getDriveClientForUser` and return a clear `400` — `"Connect your Google Drive before creating an album"` — instead of letting `getDriveClientForUser`'s generic throw surface as an opaque `500`.

## Error Handling

Same conventions as every prior plan: routes return `{ error: string }` with an appropriate status; no password hash, token, or Drive credential ever appears in a response body or log line beyond what's already the case (`decrypt`/`encrypt` and `hashPassword`/`verifyPassword` are unchanged, proven-safe utilities from Plans 1 and 3).

## Testing

- `CredentialsProvider.authorize`: correct password → user object with role; wrong password → rejected; Google-only account (no `passwordHash`) → rejected; unknown email → rejected.
- `POST /api/auth/register`: duplicate email → `409`; short password → `400`; happy path creates a `PHOTOGRAPHER` with a hashed password, response never contains the hash.
- `POST /api/auth/forgot-password`: always `200`; existing password-account → an email is sent (mock Resend) and a token row created; nonexistent or Google-only account → no email sent, still `200`.
- `POST /api/auth/reset-password`: valid unexpired token → password updated, token marked used; expired token → `400`; already-used token → `400`; wrong/unknown token → `400`.
- `GET /api/drive/connect` / `.../callback`: no session → `401` on both; callback attaches the encrypted refresh token to the session user, not a new user row.
- The album-creation gate: a session user with no `encryptedRefreshToken` gets the clear `400` message, not a `500`.

## Out of Scope

reCAPTCHA, email verification at registration, all UI, and any change to the existing Google sign-in flow's behavior.
