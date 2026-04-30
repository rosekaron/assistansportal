# Requirements: Kalinga Assistansportal

**Defined:** 2026-04-30
**Core Value:** The guardian can complete the full monthly cycle — approve hours, generate all required forms, issue the lönespec, calculate pay — without needing an HR department or assistance company.

## v1.0.2 Requirements — Production Deployment

Requirements for deploying the platform to production on azin.run.

### Container

- [ ] **CONT-01**: App builds as a single production Docker image (multi-stage: build stage + runtime stage)
- [ ] **CONT-02**: `qpdf` installed via `apt-get` in the runtime stage (replaces Homebrew PATH hack in `server/src/index.ts`)
- [ ] **CONT-03**: `forms/` directory (fk3057.pdf, fk3059.pdf, skv4805.pdf) present at the correct path inside the container at runtime
- [ ] **CONT-04**: Server serves compiled React client as static files when `NODE_ENV=production` (Express `static` middleware for `client/dist`)
- [ ] **CONT-05**: Docker image builds and runs correctly locally with production-style env vars before pushing to Azin

### Deployment

- [ ] **DEPLOY-01**: GitHub repo connected to Azin project; push to `main` triggers automatic build and deploy
- [ ] **DEPLOY-02**: Production PostgreSQL provisioned by Azin (Cloud SQL or hosted)
- [ ] **DEPLOY-03**: Drizzle schema pushed to production database (`npm run db:push` or equivalent against production `DATABASE_URL`)
- [ ] **DEPLOY-04**: All 13 environment variables configured in Azin production environment (`DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CLIENT_URL`, `PORT`, `NODE_ENV`, `FK_HOURLY_RATE`, `EMPLOYER_TAX_RATE`)

### Production Config

- [ ] **PROD-01**: `GOOGLE_REDIRECT_URI` set to production domain OAuth callback URL (`https://<domain>/api/gcal/oauth2callback`)
- [ ] **PROD-02**: Google Cloud Console authorized JavaScript origins and redirect URIs updated to include the production domain
- [ ] **PROD-03**: `CLIENT_URL` set to production URL so CORS allows browser requests from the production domain

### Smoke Test

- [ ] **SMOKE-01**: Guardian can register or log in at the production URL
- [ ] **SMOKE-02**: Guardian can download a PDF (FK 3057 or lönespec) — verifies qpdf binary works inside the container
- [ ] **SMOKE-03**: Google Calendar OAuth connect flow completes at production URL (redirect and callback succeed)

## Future Requirements

### Security Hardening (v1.0.3)

- **SEC-01**: TOCTOU race on clock-in resolved (unique constraint + SERIALIZABLE transaction)
- **SEC-02**: Multi-table DB ops wrapped in `db.transaction()` (clock.ts, assistants.ts)
- **SEC-03**: UNIQUE constraint on `assistantGuardianLinks(assistantId, guardianId)`
- **SEC-04**: JWT moved out of query parameters in gcal OAuth flow
- **SEC-05**: `e.message` not leaked to clients on 500 errors
- **SEC-06**: Multi-family Settings UI re-added in 2-section collapsible shape
- **SEC-07**: Swedish decimal-comma parsing fixed in `hourlyRateOverride` Settings input

## Out of Scope

| Feature | Reason |
|---------|--------|
| CI/CD preview environments per PR | Azin feature, not needed for initial launch |
| Custom domain (non-azin.run subdomain) | Nice-to-have, not blocking production |
| HTTPS/TLS configuration | Azin handles this automatically |
| Blue-green or canary deployments | Single-instance app, overkill for v1.0.2 |
| Automated DB migration runner (Drizzle migrate) | `db:push` sufficient for current schema evolution pace |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONT-01 | Phase 11 | Pending |
| CONT-02 | Phase 11 | Pending |
| CONT-03 | Phase 11 | Pending |
| CONT-04 | Phase 11 | Pending |
| CONT-05 | Phase 11 | Pending |
| DEPLOY-01 | Phase 12 | Pending |
| DEPLOY-02 | Phase 12 | Pending |
| DEPLOY-03 | Phase 12 | Pending |
| DEPLOY-04 | Phase 12 | Pending |
| PROD-01 | Phase 12 | Pending |
| PROD-02 | Phase 12 | Pending |
| PROD-03 | Phase 12 | Pending |
| SMOKE-01 | Phase 12 | Pending |
| SMOKE-02 | Phase 12 | Pending |
| SMOKE-03 | Phase 12 | Pending |

**Coverage:**
- v1.0.2 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-30*
*Last updated: 2026-04-30 — traceability confirmed after roadmap write (phases 11–12)*
