# Codebase Structure

**Analysis Date:** 2026-04-06

## Directory Layout

```
assistansportal/                  # Repo root — monorepo shell
├── client/                       # React SPA (Vite + TypeScript)
│   ├── src/
│   │   ├── main.tsx              # App entry point — mounts React tree
│   │   ├── App.tsx               # Router + route guards
│   │   ├── index.css             # Global Tailwind base styles
│   │   ├── components/           # Shared UI components
│   │   │   ├── Layout.tsx        # Sidebar shell for guardian app
│   │   │   ├── shared.tsx        # Cross-page components (avatars, badges)
│   │   │   └── ui/               # Primitive UI building blocks
│   │   │       ├── button.tsx
│   │   │       ├── card.tsx
│   │   │       ├── controls.tsx
│   │   │       ├── dialog.tsx
│   │   │       └── inputs.tsx
│   │   ├── pages/                # Full-page route components
│   │   │   ├── Login.tsx
│   │   │   ├── SetupWizard.tsx
│   │   │   ├── VerifySuccess.tsx
│   │   │   ├── AcceptInvite.tsx
│   │   │   ├── ResetPassword.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Calendar.tsx
│   │   │   ├── Hours.tsx
│   │   │   ├── Reports.tsx
│   │   │   ├── Assistants.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── AssistantDashboard.tsx
│   │   ├── store/                # Zustand state stores
│   │   │   └── auth.ts           # Auth state (token, role, assistantId)
│   │   └── lib/                  # Client utilities and API client
│   │       ├── api.ts            # Axios instance + all API namespace objects
│   │       ├── activities.ts     # Static activity type catalog
│   │       └── utils.ts          # cn(), date formatters, week helpers
│   ├── package.json
│   └── (vite.config, tsconfig, tailwind.config, postcss.config)
├── server/                       # Express REST API (TypeScript)
│   ├── src/
│   │   ├── index.ts              # Server entry point — Express setup + route mounting
│   │   ├── routes/               # Domain route handlers (one file per domain)
│   │   │   ├── auth.ts           # /api/auth/* — register, login, verify, invites
│   │   │   ├── profile.ts        # /api/profile — guardian/patient profile CRUD
│   │   │   ├── assistants.ts     # /api/assistants — guardian manages assistants
│   │   │   ├── assistant.ts      # /api/assistant — assistant self-service endpoints
│   │   │   ├── entries.ts        # /api/entries — schedule entry CRUD + bulk
│   │   │   ├── gcal.ts           # /api/gcal — Google Calendar OAuth + events
│   │   │   ├── misc.ts           # /api/slots, /api/blocked, /api/invites, /api/settings
│   │   │   ├── pdf.ts            # /api/pdf — FK form fill and download
│   │   │   └── costs.ts          # /api/costs — monthly cost tracking
│   │   ├── db/
│   │   │   ├── index.ts          # Drizzle client (db export) + seedDefaults()
│   │   │   └── schema.ts         # All table definitions, enums, and inferred types
│   │   ├── middleware/
│   │   │   └── auth.ts           # requireAuth, requireGuardian, requireAssistant
│   │   └── lib/
│   │       ├── email.ts          # Nodemailer transporter + 3 email sender functions
│   │       └── id.ts             # newId(prefix) — random hex ID generator
│   ├── scripts/                  # One-off server scripts (seeding, checks)
│   │   ├── check-entries.ts
│   │   ├── download-fk3059.ts
│   │   ├── seed-current-month.ts
│   │   └── seed-february.ts
│   ├── drizzle.config.ts         # Drizzle Kit config (push/generate/studio)
│   ├── package.json
│   └── tsconfig.json
├── forms/                        # Static PDF form templates (served at /forms)
│   └── fk3059.pdf                # FK 3059 Swedish personal assistant report form
├── uploads/                      # Runtime file uploads (currently empty/gitkeep)
├── docs/                         # Project documentation and test reports
│   └── test-reports/
├── .devcontainer/                # VSCode dev container configuration
├── .planning/                    # GSD planning artifacts (not shipped)
│   └── codebase/
├── package.json                  # Root workspace — runs both apps via concurrently
├── docker-compose.yml            # Local PostgreSQL container
├── setup.sh                      # Dev environment bootstrap script
└── start.sh                      # Quick start script
```

## Directory Purposes

**`client/src/pages/`:**
- Purpose: Full-page route components — one file per route
- Contains: Large self-contained page components with local state, React Query calls, and inline subcomponents
- Key files: `Calendar.tsx` (35KB), `Reports.tsx` (36KB), `Assistants.tsx` (19KB) are the most complex pages

**`client/src/components/ui/`:**
- Purpose: Low-level primitive UI components wrapping Radix UI
- Contains: `button.tsx`, `card.tsx`, `controls.tsx` (select, checkbox, switch, tabs), `dialog.tsx`, `inputs.tsx` (input, label, badge)
- Key files: `controls.tsx` — most complex, covers many form controls

**`client/src/components/` (root level):**
- Purpose: Composed, app-specific shared components used across multiple pages
- Contains: `Layout.tsx` (sidebar navigation shell), `shared.tsx` (AssistantAvatar, AvatarStack, status badge helpers)

**`client/src/lib/`:**
- Purpose: Client-side pure utilities and the API boundary
- Contains: `api.ts` (the only place HTTP calls are made), `activities.ts` (static data), `utils.ts` (formatting helpers)

**`client/src/store/`:**
- Purpose: Global client state that outlives individual components
- Contains: Only `auth.ts` — the single Zustand store; persisted to localStorage key `"auth"`

**`server/src/routes/`:**
- Purpose: HTTP handler logic, one Express Router per domain
- Contains: All business logic lives here; routes directly call `db` — no intermediate service layer
- Key files: `auth.ts` (11KB, most complex), `pdf.ts` (11KB), `gcal.ts` (7KB)

**`server/src/db/`:**
- Purpose: Database connection and schema — single source of truth for all data types
- Contains: `schema.ts` defines all tables and exports TypeScript types; `index.ts` exports `db` singleton and `seedDefaults`

**`server/src/lib/`:**
- Purpose: Reusable server utilities that are not route handlers
- Contains: `email.ts` (all email sending), `id.ts` (ID generation)

**`server/scripts/`:**
- Purpose: One-off administrative/development scripts run via `tsx`
- Contains: Data seeding and inspection scripts; not part of the production server

**`forms/`:**
- Purpose: Static Swedish government PDF forms served at `/forms` path
- Contains: `fk3059.pdf` — the FK 3059 personal assistant time report template
- Note: Forms are served as static files AND read by the PDF route for form-filling

## Key File Locations

**Entry Points:**
- `server/src/index.ts`: Express server bootstrap, route mounting, DB seed
- `client/src/main.tsx`: React app mount, QueryClient and BrowserRouter setup

**Configuration:**
- `server/drizzle.config.ts`: Drizzle Kit DB schema push/migration config
- `server/.env`: Server environment variables (DATABASE_URL, JWT_SECRET, GMAIL_*, GOOGLE_*)
- `client/` (vite, tsconfig, tailwind configs): Build tooling for the SPA

**Core Logic:**
- `server/src/db/schema.ts`: All DB tables, enums, and TypeScript types
- `server/src/middleware/auth.ts`: JWT auth enforcement — `requireAuth`, `requireGuardian`, `requireAssistant`
- `client/src/lib/api.ts`: All HTTP calls to backend, with auth interceptors
- `client/src/store/auth.ts`: Session state — token, role, assistantId

**Testing:**
- `docs/test-reports/`: Existing test reports directory
- `server/scripts/check-entries.ts`: Manual DB inspection script

## Naming Conventions

**Files:**
- PascalCase for React components: `Dashboard.tsx`, `AssistantDashboard.tsx`, `Layout.tsx`
- camelCase for non-component TypeScript modules: `api.ts`, `auth.ts`, `schema.ts`, `utils.ts`
- kebab-case not used in this codebase

**Directories:**
- All lowercase: `routes/`, `components/`, `pages/`, `store/`, `lib/`, `db/`, `middleware/`

**Database IDs:**
- Prefixed random hex via `newId(prefix)` from `server/src/lib/id.ts`
- Examples: `"e" + hex` for entries, `"s" + hex` for slots, `"b" + hex` for blocked, `"inv" + hex` for invites
- Assistants use plain hex without prefix

**API Routes:**
- REST style with domain prefix: `/api/auth/*`, `/api/entries/*`, `/api/assistants/*`
- Assistant self-service routes are separate from guardian routes: `/api/assistant/*` vs `/api/assistants/*`

**React Components:**
- Page components: PascalCase, in `client/src/pages/`
- UI primitives: PascalCase, in `client/src/components/ui/`
- Shared app components: PascalCase, in `client/src/components/`

## Where to Add New Code

**New Guardian Page:**
- Page component: `client/src/pages/NewPage.tsx`
- Add route in `client/src/App.tsx` inside the guardian `<Route>` block wrapping `<Layout>`
- Add nav link in `client/src/components/Layout.tsx` `nav` array

**New API Endpoint (Guardian):**
- Add handler in the relevant route file in `server/src/routes/`
- Apply `requireAuth` (and optionally `requireGuardian`) middleware
- Add corresponding API call to the appropriate namespace object in `client/src/lib/api.ts`

**New API Endpoint (Assistant self-service):**
- Add handler to `server/src/routes/assistant.ts` (router-level `requireAuth` already applied)
- Add call to `assistantSelfApi` in `client/src/lib/api.ts`

**New Database Table:**
- Add table definition to `server/src/db/schema.ts`
- Export the inferred type: `export type X = typeof xTable.$inferSelect`
- Run `npm run db:push` in `server/` to push schema to PostgreSQL

**New Shared UI Component:**
- If app-specific (uses domain types): `client/src/components/shared.tsx`
- If a UI primitive (wraps Radix): new or existing file in `client/src/components/ui/`

**Utilities:**
- Date/string formatting: `client/src/lib/utils.ts`
- Server ID generation: `server/src/lib/id.ts` (`newId(prefix)`)
- Static data catalogs: `client/src/lib/` (see `activities.ts` as pattern)

**New Email Template:**
- Add a new exported async function to `server/src/lib/email.ts`
- Uses the shared `transporter` and `FROM` / `BASE` constants already defined there

## Special Directories

**`.planning/`:**
- Purpose: GSD planning and codebase analysis artifacts
- Generated: No (human/AI written)
- Committed: Yes (`.planning/codebase/` is tracked)

**`uploads/`:**
- Purpose: Runtime file upload storage
- Generated: Yes (at runtime)
- Committed: No (only `.gitkeep` committed)

**`forms/`:**
- Purpose: Static PDF templates for government forms
- Generated: No (manually added)
- Committed: Yes (binary PDF assets)

**`server/scripts/`:**
- Purpose: Development and data-admin scripts, run manually with `npx tsx`
- Generated: No
- Committed: Yes

**`.devcontainer/`:**
- Purpose: VSCode Dev Container setup for reproducible development environment
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-04-06*
