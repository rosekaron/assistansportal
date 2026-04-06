# Deferred Items — Phase 02 Leave & Absence Foundation

## Untracked Database Columns (discovered in 02-02)

**Discovered during:** Plan 02-02 Task 2 (database schema push)

**Issue:** The PostgreSQL dev database contains 3 columns that are NOT in `server/src/db/schema.ts`:

| Table | Column | Type | Data present |
|-------|--------|------|--------------|
| assistants | guardian_auth_id | integer | Yes (value: 10 in 2 rows) |
| assistants | family_label | text | Yes ("Erik Larsson" in 2 rows) |
| profile | auth_id | integer | Yes (values: 8, 11) |

**Why deferred:** These columns are outside the scope of 02-02 (schema additions only). Dropping them without investigation risks data loss. They appear to be from an earlier migration or experimental multi-tenant schema attempt.

**Impact on future plans:** Any future `drizzle-kit push` will prompt to drop these columns interactively. Until resolved, use direct pg DDL for schema changes or investigate whether these columns should be added to schema.ts.

**Recommended action before 02-03 or 02-04:**
1. Check git history to find when these columns were added (`git log --all -- server/src/db/schema.ts`)
2. Determine if they are needed for multi-tenant support (guardianId scoping was a Phase 2 goal)
3. Either: add them to schema.ts (if needed) or drop them after confirming they're unused by application code

**Investigation commands:**
```bash
# Search codebase for usage of these column names
grep -r "guardian_auth_id\|family_label" server/src/
grep -r "auth_id" server/src/ | grep -v "authId\|passwordHash\|email_verified"
```
