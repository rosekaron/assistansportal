# Technology Stack

**Analysis Date:** 2026-04-06

## Languages

**Primary:**
- TypeScript 5.4.5 - Both server (`server/`) and client (`client/`)

**Secondary:**
- JavaScript - Config files (`tailwind.config.js`, `postcss.config.js`)

## Runtime

**Environment:**
- Node.js 22 (LTS) — defined in `.devcontainer/Dockerfile` via `javascript-node:dev-22-bookworm`

**Package Manager:**
- npm (root, server, client each have their own `package.json`)
- Lockfiles: `package-lock.json` present at root and `client/`; `server/` uses npm without a committed lockfile

## Frameworks

**Backend:**
- Express 4.19.2 — HTTP server and REST API (`server/src/index.ts`)

**Frontend:**
- React 18.3.1 — UI framework (`client/`)
- React Router DOM 6.23.1 — Client-side routing (`client/src/`)
- Vite 5.2.12 — Dev server and build tool (`client/vite.config.ts`)

**Testing:**
- Not detected — no test runner configured

**Build/Dev:**
- tsx 4.9.3 — TypeScript execution and watch mode for server dev (`server/`)
- concurrently 8.2.2 — Runs client and server dev servers in parallel (root `package.json`)

## Key Dependencies

**Critical:**
- drizzle-orm 0.30.10 — ORM for PostgreSQL database access (`server/src/db/`)
- drizzle-kit 0.21.4 — Schema migrations and DB studio (`server/package.json`)
- pg 8.11.5 — PostgreSQL driver (`server/src/db/index.ts`)
- jsonwebtoken 9.0.2 — JWT issuance and verification (`server/src/middleware/auth.ts`)
- bcryptjs 2.4.3 — Password hashing (`server/src/routes/auth.ts`)
- zod 3.23.8 — Runtime validation (both client and server)

**PDF Generation:**
- pdf-lib 1.17.1 — Fill and flatten AcroForm PDF fields (`server/src/routes/pdf.ts`)
- node-qpdf2 2.0.0 — Decrypt owner-password-protected PDFs before filling; requires `qpdf` binary from Homebrew (`server/src/index.ts` sets `/opt/homebrew/bin` on PATH)
- qpdf (system binary) — Must be installed separately (`brew install qpdf`)

**Frontend UI:**
- @radix-ui/* (multiple packages) — Headless accessible components: avatar, checkbox, dialog, dropdown-menu, label, progress, radio-group, select, separator, slot, switch, tabs, toast, tooltip
- @tanstack/react-query 5.37.1 — Server state management
- zustand 4.5.2 — Client state management (`client/src/store/`)
- axios 1.7.2 — HTTP client with interceptors (`client/src/lib/api.ts`)
- react-hook-form 7.51.5 + @hookform/resolvers 3.6.0 — Form handling
- lucide-react 0.383.0 — Icon library
- date-fns 3.6.0 — Date manipulation
- class-variance-authority 0.7.0 + clsx 2.1.1 + tailwind-merge 2.3.0 — Component variant and class utilities

**Infrastructure:**
- nodemailer 6.9.13 — Email sending via Gmail SMTP (`server/src/lib/email.ts`)
- multer 1.4.5-lts.1 — Multipart/file upload handling (`server/`)
- cors 2.8.5 — CORS middleware (`server/src/index.ts`)
- dotenv 16.4.5 — Environment variable loading (`server/`)
- googleapis 140.0.1 — Google Calendar OAuth2 + API (`server/src/routes/gcal.ts`)

**Styling:**
- Tailwind CSS 3.4.4 — Utility CSS (`client/tailwind.config.js`)
- tailwindcss-animate 1.0.7 — Accordion/motion animations
- autoprefixer 10.4.19 + postcss 8.4.38 — CSS processing

## Configuration

**Environment:**
- Server reads `.env` via `dotenv` in `server/src/db/index.ts` and `server/src/index.ts`
- Root `.env` is also mounted into devcontainer workspace (via `.devcontainer/docker-compose.yml`)
- `.env.sample` at root documents base variables: `NODE_PASSWORD`, `DATABASE_URL`
- Full set of required vars (from source analysis): `DATABASE_URL`, `JWT_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `CLIENT_URL`, `PORT`

**Build:**
- Server: `server/tsconfig.json` — target ES2022, CommonJS modules, outputs to `server/dist/`
- Client: `client/tsconfig.json` + `client/vite.config.ts` — ESM, aliased `@` → `client/src/`
- Vite dev proxy: `/api` → `http://localhost:3001` (so client and server share one origin in dev)

## Platform Requirements

**Development:**
- Node.js 22
- Docker + Docker Compose (Postgres container via `docker-compose.yml`)
- `qpdf` binary (macOS: `brew install qpdf`) — server hardcodes `/opt/homebrew/bin` in PATH

**Production:**
- Deployment target not explicitly defined; server exports `dist/index.js` via `npm run build && node dist/index.js`
- PostgreSQL 16 required (see `docker-compose.yml`)

---

*Stack analysis: 2026-04-06*
