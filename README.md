# Assistansportal


**Note:** This project driven by solving a personal need and a passion for wanting to solve this for people who feel the same pain. I am learning how to leverage AI to create the product I've been burning to build, making mistakes and having fun as I go. 

## Learn from my mistakes

[rose.karon.se/blog](https://rose.karon.se/blog/) 

MAJK, this is for you. Thank you for helping me understand my strength and resilience. 

===

Assistansportal
Care management platform for personal assistance — Nordics & Europe

Problem
In Sweden alone, over 17,000 people receive state-funded personal assistance under LSS. Thousands more self-arrange care outside the public system. The families, individuals, and small care companies managing this assistance spend hours every week on manual administration: tracking hours in Excel, filing reports to Försäkringskassan, managing payroll and Skatteverket forms using tools never designed for this purpose.
The result: administrative burden falls on the people least equipped to carry it — caregivers and care recipients — while small operators risk compliance failures, delayed reimbursements, and staff frustration.
No modern, purpose-built solution exists for this market.

Solution
Assistansportal is a care management platform that digitizes and automates the core administrative workflows of personal assistance management.
MVP (launching Q3 2025):

Digital assistance hour logging
Automated Försäkringskassan form generation
Automated Skatteverket and payroll form generation

Full platform:

Care instructions: structured documentation from parents and primary caregivers, accessible to all assistants
Knowledge base: condition-specific guidance for rare diseases, keeping care teams informed
Hjälpmedel discovery: helping families find assistive equipment relevant to their specific diagnosis
Therapy and exercise: logging and tracking rehabilitation, physio, and daily exercise programs
Activities: planning and recording activities as part of the care plan
Funding and appeals: helping families discover additional funding sources and navigate LSS decision appeals
Events: coordinating care-related appointments, reviews, and milestones

Roadmap:

B2B features for care companies: staff scheduling, multi-client management, compliance reporting
European expansion: adapting the compliance layer to German, Dutch, and broader EU regulatory frameworks
API integrations with payroll providers and public sector systems


Market
SegmentSizeSweden TAM ~€150M annually
Nordic TAM ~€400M annually
Europe TAM €2B+ annually
The personal assistance market is publicly funded, highly regulated, and structurally resistant to disruption from generic software. 
Compliance requirements create deep switching costs and strong retention once adopted.

Traction

Beta cohort recruited pre-launch: families self-managing personal assistance who have committed to test the platform
Founder has firsthand operational experience navigating the Swedish personal assistance system as a caregiver
MVP in active development


Business Model
SaaS. Tiered pricing:

Consumer: Individual families and self-arrangers — low monthly fee
SMB: Small care companies — per-seat or per-client pricing
Enterprise: Larger care operators — custom contracts

High retention expected due to regulatory dependency and data lock-in.

---

## Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | React 18 + Vite + TypeScript + Tailwind + shadcn/ui |
| Backend  | Node.js + Express + TypeScript          |
| ORM      | Drizzle ORM                             |
| Database | PostgreSQL 16 (via Docker)              |
| PDF      | pdf-lib (FK 3057 form filling)          |

---

## Prerequisites

Install these once on your Mac:

### 1. Node.js (v20+)
```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc   # or ~/.zshrc
nvm install 20
nvm use 20

# Or download directly from:
# https://nodejs.org
```

### 2. Docker Desktop
Download and install from https://docker.com/products/docker-desktop

Start Docker Desktop before running the app.

---

## First-time setup

```bash
# 1. Clone / download the project
cd assistansportal

# 2. Start the database
docker-compose up -d

# 3. Install all dependencies (client + server)
npm install

# 4. Push the database schema
npm run db:push

# 5. Start the app
npm run dev
```

The app will be available at **http://localhost:5173**

---

## Daily use

```bash
# Start database (if not already running)
docker-compose up -d

# Start the app
npm run dev
```

Two terminals will open:
- Server → http://localhost:3001
- Client → http://localhost:5173

Open **http://localhost:5173** in your browser.

---

## First launch

1. Go to http://localhost:5173
2. Click **Register** and create your account with your email + password
3. Complete the **4-step setup wizard**:
   - Your details as guardian
   - Your child's details + FK decision number + weekly hours (e.g. 129)
   - Add your 5 assistants with their minimum weekly hours
   - Done — enter the portal

---

## FK PDF forms

### FK 3057 (Räkning / Invoice)

1. Download the official blank form from Försäkringskassan:
   https://www.forsakringskassan.se/download/18.398e2a517628d5349875c8/1620895495452/3057.pdf

2. Place it in the `forms/` folder:
   ```
   assistansportal/forms/fk3057.pdf
   ```

3. On the Dashboard, click **Download PDF** next to "FK 3057 — Räkning"

The form is filled automatically with:
- Guardian name + personal ID
- Patient name + personal ID
- Year + month (digits)
- Total approved active hours for the month
- Signature date + phone

### FK 3059 (Tidsredovisning / Time report)

Download and place at `forms/fk3059.pdf`. Support for this form is in progress.

---

## Project structure

```
assistansportal/
├── client/                  # React frontend
│   ├── src/
│   │   ├── pages/           # Dashboard, Hours, Assistants, Settings, Login, SetupWizard
│   │   ├── components/      # Layout, shared components, shadcn UI
│   │   ├── lib/             # API client, utilities, activity types
│   │   └── store/           # Zustand auth store
│   └── ...
├── server/                  # Express backend
│   └── src/
│       ├── db/              # Drizzle schema + connection
│       ├── routes/          # auth, profile, assistants, entries, misc, pdf
│       ├── middleware/       # JWT auth
│       └── lib/             # ID generator
├── forms/                   # Drop FK PDF forms here
├── uploads/                 # File uploads
├── docker-compose.yml       # PostgreSQL
└── package.json             # Workspace root
```

---

## Environment variables

The server reads from `server/.env`:

```env
DATABASE_URL=postgresql://assistans:assistans_local@localhost:5432/assistansportal
JWT_SECRET=change_me_to_a_long_random_string_in_production
PORT=3001
CLIENT_URL=http://localhost:5173

# Google Calendar OAuth (optional — get from Google Cloud Console)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/gcal/callback
```

For local development the defaults work as-is. Change `JWT_SECRET` before any real use.

---

## Database management

```bash
# View and edit data in a browser UI
npm run db:studio

# Regenerate migrations after schema changes
npm run db:generate --workspace=server

# Push schema changes directly (dev only)
npm run db:push
```

---

## Activity types and 2-assistant capacity

Activities that require 2 assistants simultaneously are pre-configured:

| Activity         | Assistants |
|------------------|-----------|
| 🐴 Horse riding  | 2         |
| 🏊 Swimming      | 2         |
| 🏋️ Physiotherapy | 2         |
| ⚡ Active time   | 2         |
| 🛁 Bathing       | 2         |
| 🍽️ Feeding       | 2         |
| 🧼 Personal care | 1         |
| 🏫 School support| 1         |
| 💬 Companionship | 1         |
| 🌙 Overnight     | 1         |

When you create an open slot, selecting a 2-person activity automatically sets the capacity. The Available Slots tab shows a fill bar and keeps the slot open until both assistants are assigned.

---

## Scheduling flow

```
Guardian creates open slot (with activity)
        ↓
Guardian proposes to assistant → tentative calendar event
        ↓
Assistant accepts → confirmed calendar event
        ↓
Month ends → guardian approves time reports
        ↓
Generate FK 3057 PDF → send to Försäkringskassan
```

Or assistants can self-book directly from open slots (configurable in Settings).

---

## Stopping the app

```bash
# Stop the dev servers
Ctrl+C

# Stop the database (optional — data is preserved)
docker-compose down

# Stop the database AND delete all data (destructive!)
docker-compose down -v
```

---

## Troubleshooting

**"Cannot connect to database"**
→ Make sure Docker Desktop is running, then: `docker-compose up -d`

**"Port 5432 already in use"**
→ Another Postgres is running. Either stop it, or change the port in `docker-compose.yml` and `server/.env`.

**"FK PDF not found"**
→ Place the downloaded PDF at `forms/fk3057.pdf`

**White screen / React errors**
→ Check the browser console. Most likely a missing import — run `npm install` again.
