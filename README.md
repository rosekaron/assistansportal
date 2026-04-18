# Kalinga Assistansportal

**Note:** This project is driven by solving a personal need and a passion for wanting to solve this for people who feel the same pain. I am learning how to leverage AI to create the product I've been burning to build, making mistakes and having fun as I go.

## Learn from my mistakes

[rose.karon.se/blog](https://rose.karon.se/blog/)

MAJK, this is for you. Thank you for helping me understand my strength and resilience.

---

## Care management platform for personal assistance — Nordics & Europe

### Problem

In Sweden alone, over 17,000 people receive state-funded personal assistance under LSS. Thousands more self-arrange care outside the public system. The families, individuals, and small care companies managing this assistance spend hours every week on manual administration: tracking hours in Excel, filing reports to Försäkringskassan, managing payroll and Skatteverket forms using tools never designed for this purpose.

The result: administrative burden falls on the people least equipped to carry it — caregivers and care recipients — while small operators risk compliance failures, delayed reimbursements, and staff frustration.

No modern, purpose-built solution exists for this market.

### Solution

Assistansportal is a care management platform that digitizes and automates the core administrative workflows of personal assistance management.

**Shipped in v1.0** (2026-04-18):

- Digital assistance hour logging
- Automated Försäkringskassan form generation (FK 3057, FK 3059)
- Automated Skatteverket declaration generation (SKV 4805)
- Payroll calculation with 2026 Swedish tax rates
- Multi-assistant schedule grid + Google Calendar integration
- Monthly compliance checklist with FK and AGI deadline tracking
- Email deadline reminders

**v1.0.1 in progress** (branch `milestone/v1.0.1`):

- ✓ Phase 7 — Foundation: Schema & Cleanup (2026-04-18). Schema extended with 23 new columns + 3 enums on `assistants`/`profile`/`payroll_records` for FK-beslut metadata, bank details, tax scheme, split address, employment dates, patient-representation override, and salary-model snapshots. Dead scheduling scaffolding removed (`open_slots` table, `/api/slots` + self-book endpoints, Settings Scheduling card, `slotsApi` client helpers). Settings UI rebuilt with 2-section collapsibles for Profile (Personuppgifter / FK-beslut) and Assistants edit dialog (Personuppgifter / Anställning & ekonomi). SetupWizard captures minimum fields for downstream phases.
- ☐ Phase 8 — Employer Representation Helper (next). Single `resolveEmployerRepresentation()` helper to replace hardcoded `guardianName` in FK 3057/3059, SKV 4805, and the upcoming salary slip.
- ☐ Phase 9 — Salary Slip (anhörig model) — legally required per Swedish labor law.
- ☐ Phase 10 — Real Data Entry & End-to-End Verification.

**Vision — full platform:**

- **Care instructions:** structured documentation from parents and primary caregivers, accessible to all assistants
- **Knowledge base:** condition-specific guidance for rare diseases, keeping care teams informed
- **Hjälpmedel discovery:** helping families find assistive equipment relevant to their specific diagnosis
- **Therapy and exercise:** logging and tracking rehabilitation, physio, and daily exercise programs
- **Activities:** planning and recording activities as part of the care plan
- **Funding and appeals:** helping families discover additional funding sources and navigate LSS decision appeals
- **Events:** coordinating care-related appointments, reviews, and milestones

**Future roadmap:**

- B2B features for care companies: staff scheduling, multi-client management, compliance reporting
- European expansion: adapting the compliance layer to German, Dutch, and broader EU regulatory frameworks
- API integrations with payroll providers and public sector systems

### Market

| Segment | Size |
|---------|------|
| Sweden TAM | ~€150M annually |
| Nordic TAM | ~€400M annually |
| Europe TAM | €2B+ annually |

The personal assistance market is publicly funded, highly regulated, and structurally resistant to disruption from generic software. Compliance requirements create deep switching costs and strong retention once adopted.

### Traction

- Beta cohort recruited pre-launch: families self-managing personal assistance who have committed to test the platform
- Founder has firsthand operational experience navigating the Swedish personal assistance system as a caregiver
- v1.0 shipped 2026-04-18 — full monthly compliance cycle working end-to-end

### Business Model

SaaS. Tiered pricing:

- **Consumer:** Individual families and self-arrangers — low monthly fee
- **SMB:** Small care companies — per-seat or per-client pricing
- **Enterprise:** Larger care operators — custom contracts

High retention expected due to regulatory dependency and data lock-in.

---

## Current state

**Shipped:** v1.0 — Stability, Compliance, and Core Payroll (2026-04-18). Full monthly compliance cycle working end-to-end.

**Active milestone:** [v1.0.1 — Salary Slip + Foundation Cleanup](.planning/ROADMAP.md) on branch `milestone/v1.0.1`. Phase 7 (Foundation — Schema & Cleanup) complete as of 2026-04-18 with 22/22 must-haves verified. Phases 8 (Employer Representation), 9 (Salary Slip), and 10 (Real Data Entry) remaining.

**Target users today:** disabled people and their families who have chosen to self-manage their assistansersättning (personal assistance compensation from Försäkringskassan) rather than delegate to a staffing company like Humana or Attendo. The platform handles the full monthly compliance cycle — scheduling assistants, tracking hours, generating FK and Skatteverket forms, calculating payroll — so the guardian can run their own "micro-assistance employer" without specialist knowledge.

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
