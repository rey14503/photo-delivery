# Add Photographer Info Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 essential photographer/studio profile fields (`phone`, `facebookUrl`, `bankName`, `bankAccountNumber`, `bankAccountName`, `qrCodeUrl`) to the `User` model, allow editing via `EditProfileModal`, and surface them in team management and client galleries (`/a/[shareToken]`).

**Architecture:** Extend Prisma `User` model with optional nullable string fields, update `GET /api/user/profile` and `PUT /api/user/profile` endpoints, enhance `EditProfileModal` with tabs or grouped sections for Contact/Social and Banking/QR code, and pass these details into `ClientGallery` so clients can contact the photographer or scan the payment QR code.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma ORM, PostgreSQL, React CSS Modules, Vitest.

## Global Constraints

- Never break existing `User` records; new fields must be nullable (`String?`).
- Maintain strict TypeScript safety across API routes and React component props.
- Ensure all new UI inputs in `EditProfileModal` respect `--bg-surface`, `--text-main`, and `--border-color` for perfect Light and Dark theme compatibility.
- Ensure all existing 302 Vitest unit tests pass cleanly and add new test cases for the updated API endpoints and UI components.

---

### Task 1: Extend Prisma Schema & Update Types

**Files:**
- Modify: `prisma/schema.prisma:16-30`
- Modify: `src/app/api/user/profile/route.ts:1-93`
- Test: `tests/api/user-profile.test.ts`

**Interfaces:**
- Consumes: Existing `User` schema (`id`, `email`, `name`, `studioName`, `role`, `avatarUrl`).
- Produces: `User` with nullable `phone`, `facebookUrl`, `bankName`, `bankAccountNumber`, `bankAccountName`, `qrCodeUrl`.

- [ ] **Step 1: Write the failing test for PUT /api/user/profile saving new fields**

```typescript
// Add test case in tests/api/user-profile.test.ts verifying that PUT /api/user/profile
// accepts and returns phone, facebookUrl, bankName, bankAccountNumber, bankAccountName, qrCodeUrl
```

- [ ] **Step 2: Update `prisma/schema.prisma`**

```prisma
model User {
  id                    String   @id @default(cuid())
  email                 String   @unique
  name                  String?
  role                  Role     @default(PHOTOGRAPHER)
  avatarUrl             String?
  studioName            String?
  phone                 String?
  facebookUrl           String?
  bankName              String?
  bankAccountNumber     String?
  bankAccountName       String?
  qrCodeUrl             String?
  ...
}
```

- [ ] **Step 3: Run `npx prisma db push` and `npx prisma generate`**

- [ ] **Step 4: Update `src/app/api/user/profile/route.ts` (GET and PUT)**

```typescript
// Add phone, facebookUrl, bankName, bankAccountNumber, bankAccountName, qrCodeUrl to GET select and response.
// Validate and save optional fields in PUT handler.
```

- [ ] **Step 5: Run unit tests (`npm test tests/api/user-profile.test.ts`) and ensure they pass**

---

### Task 2: Enhance EditProfileModal UI with Contact & Banking Fields

**Files:**
- Modify: `src/components/EditProfileModal.tsx:1-263`
- Modify: `src/components/EditProfileModal.module.css:1-200`
- Test: `tests/components/EditProfileModal.test.tsx` (or new unit test file)

**Interfaces:**
- Consumes: Updated profile fields from `/api/user/profile`.
- Produces: UI inputs enabling photographers to update contact number (`phone`), Facebook link (`facebookUrl`), bank details (`bankName`, `bankAccountNumber`, `bankAccountName`), and QR payment image URL (`qrCodeUrl`).

- [ ] **Step 1: Write failing unit test for EditProfileModal rendering and saving new fields**
- [ ] **Step 2: Update `EditProfileModalProps` and component state to handle the 6 new fields**
- [ ] **Step 3: Add grouped form sections ("Contact & Social" and "Payment & VietQR") inside `EditProfileModal.tsx`**
- [ ] **Step 4: Style the new inputs and sections cleanly inside `EditProfileModal.module.css`**
- [ ] **Step 5: Run Vitest tests to verify UI interaction and save callbacks**

---

### Task 3: Surface Photographer Contact & QR Code on Client Gallery (`/a/[shareToken]`)

**Files:**
- Modify: `src/app/a/[shareToken]/page.tsx:18-35`
- Modify: `src/components/ClientGallery.tsx`
- Modify: `src/components/ClientGallery.module.css`

**Interfaces:**
- Consumes: `album.owner` with `phone`, `facebookUrl`, `bankName`, `bankAccountNumber`, `bankAccountName`, `qrCodeUrl`.
- Produces: Photographer contact card / Payment QR pop-up on the client delivery page so clients can call, Zalo, message, or transfer payments directly.

- [ ] **Step 1: Update `album.findUnique` query inside `src/app/a/[shareToken]/page.tsx` to include `phone`, `facebookUrl`, `bankName`, `bankAccountNumber`, `bankAccountName`, `qrCodeUrl` inside `owner.select`**
- [ ] **Step 2: Pass photographer contact and banking details into `ClientGallery` props**
- [ ] **Step 3: Add "Photographer Contact" & "VietQR Payment" buttons/modals inside `ClientGallery.tsx`**
- [ ] **Step 4: Verify complete test suite (`npm test`) passes cleanly**
