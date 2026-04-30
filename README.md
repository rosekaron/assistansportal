<!-- generated-by: gsd-doc-writer -->
# Assistansportal

Care management platform for personal assistance — built for families, individuals, and care companies operating under the Swedish LSS system.

**Note:** This project is driven by solving a personal need and a passion for wanting to solve this for people who feel the same pain. I am learning how to leverage AI to create the product I've been burning to build, making mistakes and having fun as I go.

[Read about the journey → rose.karon.se/blog](https://rose.karon.se/blog/)

*MAJK, this is for you. Thank you for helping me understand my strength and resilience.*

---

## Problem

In Sweden alone, over 17,000 people receive state-funded personal assistance under LSS. Thousands more self-arrange care outside the public system. The families, individuals, and small care companies managing this assistance spend hours every week on manual administration: tracking hours in Excel, filing reports to Försäkringskassan, managing payroll and Skatteverket forms using tools never designed for this purpose.

The result: administrative burden falls on the people least equipped to carry it — caregivers and care recipients — while small operators risk compliance failures, delayed reimbursements, and staff frustration.

No modern, purpose-built solution exists for this market.

---

## Stack

| Layer     | Technology                                              |
|-----------|---------------------------------------------------------|
| Frontend  | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Backend   | Node.js + Express + TypeScript                          |
| ORM       | Drizzle ORM                                             |
| Database  | PostgreSQL 16 (via Docker)                              |
| PDF forms | pdf-lib + pdfkit (FK 3057 and payroll form generation)  |
| Auth      | JWT (jsonwebtoken + bcryptjs)                           |

---

## Installation

### Prerequisites

- Node.js >= 20
- Docker and Docker Compose (for PostgreSQL)
- npm >= 10

### Steps

```bash
git clone https://github.com/rosekaron/assistansportal.git
cd assistansportal
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

Copy the sample environment file and fill in your values:

```bash
cp .env.sample server/.env
```

Minimum required values in `server/.env`:

```
DATABASE_URL=postgres://assistans:assistans_local@localhost:5432/assistansportal
JWT_SECRET=replace-with-a-long-random-string-minimum-32-chars
```

---

## Quick start

1. Start the database:

```bash
docker compose up -d
```

2. Push the database schema:

```bash
cd server && npm run db:push && cd ..
```

3. Start both the API server and the frontend dev server:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API server: `http://localhost:3001`
- Health check: `http://localhost:3001/api/health`

---

## Usage

The platform has two distinct portals:

**Guardian portal** — for families and care recipients managing personal assistance:
- Register and manage assistants
- Log assistance hours
- Clock-in / clock-out tracking
- Generate Försäkringskassan (FK 3057) reports
- Generate Skatteverket and payroll forms
- Track costs, absences, and payments

**Assistant portal** — for personal assistants:
- Clock in and clock out
- Multi-family support (one assistant serving multiple care recipients)
- View schedule and records

---

## Database commands

```bash
# Push schema changes to the database
cd server && npm run db:push

# Open Drizzle Studio (database GUI)
cd server && npm run db:studio

# Generate a migration
cd server && npm run db:generate
```

---

## Roadmap

See [.planning/ROADMAP.md](.planning/ROADMAP.md) for the full product roadmap: MVP → V2 (care coordination + B2B) → V3 (knowledge base + LSS appeals) → Platform (assistant marketplace).

---

## Market

| Segment    | Size                |
|------------|---------------------|
| Sweden TAM | ~€150M annually     |
| Nordic TAM | ~€400M annually     |
| Europe TAM | €2B+ annually       |

The personal assistance market is publicly funded, highly regulated, and structurally resistant to disruption from generic software. Compliance requirements create deep switching costs and strong retention once adopted.
