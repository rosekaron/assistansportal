# Kalinga Assistansportal

Swedish personal-assistance (assistansersättning) self-management platform for disabled people and their families who have chosen to self-manage the FK schablon instead of delegating to a staffing company.

The platform handles the full monthly compliance cycle — scheduling assistants, tracking hours, generating Försäkringskassan and Skatteverket forms, calculating payroll — so the guardian can run their own "micro-assistance employer" without specialist knowledge.

**Status:** v1.0 shipped (2026-04-18). Next milestone: [v1.0.1 Salary Slip + Foundation Cleanup](.planning/ROADMAP.md).

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind + shadcn/ui |
| Backend | Node.js + Express + TypeScript |
| ORM | Drizzle |
| Database | PostgreSQL 16 (via Docker) |
| PDFs | pdf-lib + pdfkit (FK 3057, FK 3059, SKV 4805) |
| Auth | JWT |
| Integrations | Google Calendar (OAuth2) |

Entirely TypeScript. Single monorepo with `client/` and `server/` workspaces.

---

## Prerequisites

- **Node.js 20+** — install via `nvm` or from [nodejs.org](https://nodejs.org)
- **Docker Desktop** — [docker.com](https://www.docker.com/products/docker-desktop) (runs Postgres locally)

---

## Quick start

```bash
# 1. Start PostgreSQL
docker-compose up -d

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.sample .env
# Edit server/.env if needed — see "Environment variables" below

# 4. Push the database schema
npm run db:push --workspace=server

# 5. Start the dev servers
npm run dev
```

Open **http://localhost:5173**.

---

## What the app does

### Guardian workflow

1. **Home** — multi-assistant week schedule grid (sourced from Google Calendar); pending actions; FK invoice status for the current month
2. **Monthly** — 4-step compliance stepper: approve time entries → generate payroll → approve payroll → download FK 3057 / FK 3059 / SKV 4805 PDFs
3. **Records** — historical payroll, FK submissions, leave/absence log
4. **Settings** — profile, assistants, rates, preliminary tax rate, notifications, Google Calendar connection

### Assistant workflow

1. **Clock-in / clock-out** — verified shift reports that land on the guardian's Monthly page for approval
2. **Multi-family support** — assistants working for multiple households pick active family context
3. **Shift history + slips** (v1.0.1) — assistants see their own pay history and download slips

### Outputs

- **FK 3057 — Räkning** — monthly assistansersättning invoice to Försäkringskassan
- **FK 3059 — Tidredovisning** — monthly timesheet per assistant (guardian mails signed copies to FK)
- **SKV 4805 — Förenklad arbetsgivardeklaration** — monthly simplified employer declaration per assistant to Skatteverket (filed electronically)
- **Lönespecifikation** — per-assistant pay slip (coming in v1.0.1)

---

## Environment variables

`server/.env` (copy from `.env.sample` at the root):

```env
DATABASE_URL=postgresql://assistans:assistans_local@localhost:5432/assistansportal
JWT_SECRET=change_me_to_a_long_random_string_in_production
PORT=3001
CLIENT_URL=http://localhost:5173

# FK schablon + arbetsgivaravgifter (2026 defaults)
FK_HOURLY_RATE=334
EMPLOYER_TAX_RATE=0.3142

# Google Calendar OAuth (optional — only needed for GCal integration)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/gcal/callback

# SMTP for invite + reminder emails (optional — for local dev, use Gmail app-password)
GMAIL_USER=
GMAIL_APP_PASSWORD=
```

For local development the defaults work as-is. **Change `JWT_SECRET` before any real use.**

---

## Common commands

```bash
npm run dev                              # Start both client + server
npm run db:push --workspace=server       # Apply schema changes to DB
npm run db:studio --workspace=server     # Open Drizzle Studio
npx tsc --noEmit --project client        # Typecheck client
npx tsc --noEmit --project server        # Typecheck server
npx vitest run --project server          # Run server tests
```

Stop:
```bash
Ctrl+C                 # stop dev servers
docker-compose down    # stop database (data preserved)
docker-compose down -v # stop + delete all data (destructive)
```

---

## Project layout

```
assistansportal/
├── client/                   # React frontend
│   └── src/
│       ├── pages/            # Home, Monthly, Records, Settings, AssistantDashboard, Login, SetupWizard
│       ├── components/       # Layout + shadcn UI primitives
│       ├── lib/              # API client + helpers
│       └── store/            # Zustand auth store
├── server/                   # Express backend
│   └── src/
│       ├── db/               # Drizzle schema + seed
│       ├── routes/           # auth, entries, assistants, payroll, pdf, gcal, clock, absences, ...
│       ├── middleware/       # requireAuth, requireGuardian, requireAssistant
│       └── lib/              # calculatePayroll, filterBillableEntries, form4805-utils, ...
├── forms/                    # Reference Skatteverket / FK PDFs
├── uploads/                  # Runtime uploads (empty in repo)
├── .planning/                # Project planning + workflow (see below)
├── docker-compose.yml        # PostgreSQL
├── .env.sample               # Environment template
└── package.json              # Monorepo root
```

---

## Project planning — where the history lives

This project uses the [GSD (Get-Shit-Done) workflow](https://github.com/get-shit-done) for planning. All non-code context lives in `.planning/`.

**Start here** (in this order):

1. [`.planning/PROJECT.md`](.planning/PROJECT.md) — what the product is, core value, constraints, key decisions
2. [`.planning/ROADMAP.md`](.planning/ROADMAP.md) — **the ONE file** a new LLM / new contributor needs to resume work. Has a HANDOFF section at the top designed for cold resumption.
3. [`.planning/MILESTONES.md`](.planning/MILESTONES.md) — shipped-version history with accomplishments
4. [`.planning/milestones/v1.0-MILESTONE-AUDIT.md`](.planning/milestones/v1.0-MILESTONE-AUDIT.md) — v1.0 audit + accepted known issues

**Deeper:**

- `.planning/phases/` — per-phase plans + summaries + verifications (114 files — full dev history)
- `.planning/research/` — domain research artefacts
- `.planning/codebase/` — codebase mapping
- `.planning/compliance/` — Swedish labor-law + FK compliance notes
- `.planning/todos/pending/` — active todos with `planned_milestone` tags
- `.planning/UAT-BUG-LOG.md` — UAT defect tracking

---

## Contributing

This is a personal-use platform built by and for its primary user. There's no formal contribution process. If you're reading this and want to help:

1. Read `.planning/ROADMAP.md` top-to-bottom
2. Check `.planning/todos/pending/` for tagged work
3. Open an issue to discuss direction before any PR

---

## Known limitations (v1.0)

See [v1.0-MILESTONE-AUDIT.md](.planning/milestones/v1.0-MILESTONE-AUDIT.md) "Accepted as v1.0 Known Issues" for the full list. Summary:

- **Preliminärskatt** uses a single global flat rate (default 30%) for all assistants — Skatteverket accepts this fallback
- **Omkostnader pot** not modelled — FK schablon is treated as 100% lönekostnader instead of the Fremia ~87/8/3/2 split. Deferred pending labor-law advisor input.
- **Age-bracket arbetsgivaravgifter** (67+ = 10.21%, 19–23 = 17.77%) not supported — flat 31.42% for all
- **Salary slip** missing (v1.0.1 scope — legally required)
- **Schedule grid** reads from Google Calendar; **FK/payroll** reads from internal `entries` table — these can diverge (v2.0 reconciles)

---

## License

See [LICENSE](LICENSE) if present, otherwise consider it personal-use only.
