# Architecture

**Analysis Date:** 2026-04-06

## Pattern Overview

**Overall:** Monorepo with a separate React SPA frontend and Express REST API backend

**Key Characteristics:**
- Full separation of client and server into independent npm workspaces (`client/`, `server/`)
- Root `package.json` runs both with `concurrently` — no shared code between layers
- Server is a thin REST API: routes query the database directly via Drizzle ORM (no service layer)
- Client is a React SPA using React Query for server state and Zustand for auth state
- JWT-based stateless authentication with role-based access control (`guardian` | `assistant`)
- Two distinct user experiences gated by role: full guardian app and a simplified assistant dashboard

## Layers

**HTTP API (Server):**
- Purpose: Expose REST endpoints, enforce auth, query PostgreSQL
- Location: `server/src/`
- Contains: Express Router modules per domain, middleware, Drizzle schema, utility libs
- Depends on: PostgreSQL (via `pg` pool), Google Calendar API, Nodemailer, qpdf CLI binary
- Used by: React SPA client via `/api/*` prefix

**Data Access:**
- Purpose: Database schema definition and connection pool
- Location: `server/src/db/index.ts`, `server/src/db/schema.ts`
- Contains: Drizzle ORM schema (tables, enums, inferred TypeScript types), pool setup, seed function
- Depends on: `DATABASE_URL` env var
- Used by: All route handlers via `import { db } from "../db"`

**Middleware:**
- Purpose: JWT verification and role enforcement
- Location: `server/src/middleware/auth.ts`
- Contains: `requireAuth`, `requireGuardian`, `requireAssistant` middleware functions; `AuthRequest` type extension
- Depends on: `JWT_SECRET` env var
- Used by: All protected route handlers

**Support Libraries (Server):**
- Purpose: Reusable non-route server utilities
- Location: `server/src/lib/`
- Contains: `email.ts` (Nodemailer transporter + 3 email senders), `id.ts` (random ID generator)
- Depends on: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CLIENT_URL` env vars
- Used by: Route handlers that send email or create records

**React Application (Client):**
- Purpose: Browser UI with two role-gated experiences
- Location: `client/src/`
- Contains: Page components, shared UI components, API client, Zustand auth store
- Depends on: Server `/api` endpoints
- Used by: End users (guardians and assistants)

**Client API Layer:**
- Purpose: Centralized axios instance with auth interceptors plus typed API namespace objects
- Location: `client/src/lib/api.ts`
- Contains: Axios instance (auto-attaches Bearer token; redirects to `/login` on 401), namespaced API objects: `authApi`, `profileApi`, `assistantsApi`, `entriesApi`, `slotsApi`, `blockedApi`, `invitesApi`, `settingsApi`, `pdfApi`, `costsApi`, `gcalApi`, `assistantSelfApi`
- Depends on: `localStorage` for token
- Used by: All page components via `useQuery`/`useMutation` hooks

**Client State:**
- Purpose: Persist authentication across page loads
- Location: `client/src/store/auth.ts`
- Contains: Zustand store with `persist` middleware; fields: `token`, `role`, `assistantId`; actions: `setAuth`, `logout`
- Depends on: `localStorage` key `"auth"`
- Used by: Route guards in `App.tsx`, `Layout.tsx`, all pages needing role checks

## Data Flow

**Guardian Login:**

1. User submits credentials → `authApi.login()` → `POST /api/auth/login`
2. Server verifies password hash (bcrypt), issues JWT with `{ userId, role, assistantId }`
3. Client stores token + role in Zustand (persisted to localStorage)
4. `App.tsx` route guards (`RequireAuth`, `RequireGuardian`) allow entry to guardian routes
5. Pages load data via React Query calling named API functions

**Assistant Self-Booking:**

1. Logged-in assistant visits dashboard → `assistantSelfApi.openSlots()` → `GET /api/assistant/open-slots`
2. Server queries `open_slots`, checks fill level per slot against `entries` table
3. Assistant selects slot → `assistantSelfApi.selfBook(slotId)` → `POST /api/assistant/self-book/:slotId`
4. Server inserts entry with `source: "self_book"`, `reqStatus: "pending"`, deletes slot if now full
5. Guardian sees pending entry; approves via `PUT /api/entries/:id` → `reqStatus: "approved"`

**PDF Report Generation:**

1. Guardian selects month → `pdfApi.fk3059(year, month, assistantId)` → `POST /api/pdf/fk3059`
2. Server loads `fk3059.pdf` form from `forms/`, decrypts it via `qpdf` CLI
3. `pdf-lib` fills form fields with data queried from `entries` + `assistants` + `profile`
4. Flattened PDF buffer returned as binary response → client triggers browser download

**State Management:**
- Server state (entries, assistants, profile, etc.) managed by React Query with 30-second stale time
- Auth state (token, role) managed by Zustand with localStorage persistence
- No client-side cache invalidation strategy beyond React Query's default retry/stale behavior

## Key Abstractions

**Route Modules:**
- Purpose: Each file in `server/src/routes/` owns one domain; mounted with a prefix in `index.ts`
- Examples: `server/src/routes/auth.ts`, `server/src/routes/entries.ts`, `server/src/routes/assistant.ts`
- Pattern: `const router = Router()` → define handlers → `export default router`

**Drizzle Schema Types:**
- Purpose: Single source of truth for DB shape and TypeScript types
- Examples: `server/src/db/schema.ts` exports `type Entry`, `type Assistant`, `type Profile`, etc.
- Pattern: `export type X = typeof xTable.$inferSelect` — use these in route handler typing

**API Namespace Objects:**
- Purpose: Collocate all API calls for a domain, typed with return generics
- Examples: `entriesApi`, `assistantsApi`, `gcalApi` in `client/src/lib/api.ts`
- Pattern: Plain objects with methods returning `api.get<T>(...)` / `api.post<T>(...)` calls

**Route Guards:**
- Purpose: Composable React components that enforce auth and role before rendering children
- Examples: `RequireAuth`, `RequireGuardian`, `RequireAssistant`, `RequireSetup` in `client/src/App.tsx`
- Pattern: Read from `useAuthStore`, return `<Navigate>` if condition fails, otherwise render `children`

**Activity Types:**
- Purpose: Static catalog of care activity types with capacity defaults and metadata
- Examples: `client/src/lib/activities.ts` exports `ACTIVITY_TYPES` array and `activityById()` helper
- Pattern: Static data module; no server round-trip needed

## Entry Points

**Server:**
- Location: `server/src/index.ts`
- Triggers: `npm run dev` in `server/` (via `tsx watch`) or `npm run dev` in root (via `concurrently`)
- Responsibilities: Load env, configure Express middleware (CORS, JSON body), mount all route routers, call `seedDefaults()`, start HTTP listener on `PORT` (default 3001)

**Client:**
- Location: `client/src/main.tsx`
- Triggers: `npm run dev` in `client/` (via `vite`) or `npm run dev` in root
- Responsibilities: Mount `QueryClientProvider` (React Query), `BrowserRouter`, and root `App` component into `#root` DOM node

**Application Shell:**
- Location: `client/src/App.tsx`
- Triggers: Rendered by `main.tsx`
- Responsibilities: Declare all routes, apply role-based route guards, render `Layout` as shell for guardian routes

## Error Handling

**Strategy:** Try/catch in every async route handler; always return `res.status(N).json({ error: string })` on failure

**Patterns:**
- All route handlers wrap logic in `try { ... } catch (e) { res.status(500).json({ error: String(e) }) }`
- Auth middleware returns `401` (missing/invalid token) or `403` (wrong role) immediately via `return res.status(...)`
- Client: axios interceptor catches 401 globally, clears localStorage, redirects to `/login`
- Client: React Query propagates errors to component level; no global error boundary detected

## Cross-Cutting Concerns

**Logging:** `console.log` / `console.warn` / `console.error` in server route handlers; no structured logging library
**Validation:** Minimal — mostly presence checks (`if (!email || !password)`) in auth routes; Zod is installed but not used for request validation
**Authentication:** JWT Bearer tokens; secret from `JWT_SECRET` env var (falls back to `"dev_secret"`); tokens expire in 30 days

---

*Architecture analysis: 2026-04-06*
