# 📸 Photo Delivery Web Application

Modern, professional platform for studio photographers and clients to deliver, manage, and interact with photo albums. Built with **Next.js 15 (App Router)**, **TypeScript**, **Prisma**, **PostgreSQL**, **Google Drive API**, and **Vercel Blob Storage**.

---

## 🚀 Quick Start Guide for Developers & Contributors

If you want to clone this repository to run locally and contribute to future development, follow the step-by-step instructions below.

### 1️⃣ Prerequisites
Make sure you have the following installed on your machine:
- **Node.js**: `v20.0.0` or higher ([Download Node.js](https://nodejs.org/))
- **npm**: Comes with Node.js (`v10+`)
- **PostgreSQL**: A local PostgreSQL database instance, or a cloud PostgreSQL database like [Neon.tech](https://neon.tech) / [Supabase](https://supabase.com)
- **Git**: Installed and configured

---

### 2️⃣ Clone the Repository & Install Dependencies

Open your terminal and run:

```bash
# Clone the repository from GitHub
git clone https://github.com/rey14503/photo-delivery.git

# Navigate into the project folder
cd photo-delivery

# Install all necessary dependencies
npm install
```

---

### 3️⃣ Set Up Environment Variables

1. Copy the `.env.example` file to create your own local environment file (`.env.local`):
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` in your favorite code editor (VS Code, Cursor, etc.) and fill in your credentials:

   ```env
   # PostgreSQL Connection String (Local or Cloud like Neon/Supabase)
   DATABASE_URL="postgresql://user:password@host:5432/photo_delivery"

   # NextAuth Configuration
   NEXTAUTH_URL="http://localhost:3000"
   # Generate a secure 32-byte secret: openssl rand -base64 32
   NEXTAUTH_SECRET="your-generated-secret-here"

   # Google OAuth Credentials (for Login & Drive Integration)
   GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"

   # Encryption Key for sensitive tokens (Generate with: openssl rand -hex 32)
   ENCRYPTION_KEY="your-64-char-hex-encryption-key"

   # Root Owner / Admin Email
   ADMIN_EMAIL="your-email@example.com"

   # Vercel Blob Storage Token (required for photo & avatar uploads)
   BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxx_xxx"
   ```

---

### 4️⃣ Database Setup (Prisma)

Initialize your PostgreSQL schema and generate the Prisma Client by running:

```bash
# Push the schema definitions to your database
npx prisma db push

# Generate TypeScript types for Prisma Client
npx prisma generate
```

*(Optional)* To inspect or edit data visually using Prisma Studio:
```bash
npx prisma studio
```

---

### 5️⃣ Start the Development Server

Run the development server with Next.js Turbopack enabled:

```bash
npm run dev
```

Open your browser and navigate to: **[http://localhost:3000](http://localhost:3000)**

---

### 6️⃣ Running Automated Tests & Quality Checks

Before submitting pull requests or committing code, ensure all **302+ unit tests** pass without errors:

```bash
# Run the complete test suite once
npm test

# Or run tests in watch mode during interactive development
npm run test:watch
```

To verify production readiness:
```bash
# Lint codebase for issues
npm run lint

# Check production build
npm run build
```

---

## 🛠 Project Structure Overview

```text
├── src/
│   ├── app/                # Next.js App Router (Pages, Layouts, API Routes)
│   │   ├── api/            # Backend API Endpoints (Auth, Team, Albums, Drive, etc.)
│   │   └── globals.css     # Global Theme & Design System tokens
│   ├── components/         # Reusable UI & Modal components (ManageTeamModal, TopNav, etc.)
│   └── lib/                # Core utilities (Prisma DB, Drive API, Crypto, Auth callbacks)
├── prisma/                 # Database Schema (schema.prisma)
├── tests/                  # Automated Vitest test suites (300+ unit tests)
└── public/                 # Static assets & icons
```

---

## 🤝 Contribution Guidelines

1. **Create a Feature Branch:** Always branch off `main` for new features or bug fixes (`git checkout -b feature/awesome-new-feature`).
2. **Follow Design System Tokens:** When building UI components, utilize pre-defined CSS variables from `src/app/globals.css` (`--bg-surface`, `--text-main`, `--card-bg`, etc.) to guarantee seamless compatibility with both **Light** and **Dark** themes.
3. **Write Unit Tests:** Ensure any new functionality or bug fix is accompanied by corresponding automated tests inside `tests/`.
4. **Commit & Push:**
   ```bash
   git add .
   git commit -m "feat: description of changes"
   git push origin feature/awesome-new-feature
   ```
5. **Open a Pull Request** on GitHub for review!
