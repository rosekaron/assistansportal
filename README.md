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

## Roadmap 

https://github.com/rosekaron/assistansportal/blob/main/ROADMAP.md 
