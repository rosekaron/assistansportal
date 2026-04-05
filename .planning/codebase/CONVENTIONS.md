# Coding Conventions

**Analysis Date:** 2026-04-06

## Naming Patterns

**Files:**
- React pages: PascalCase, e.g. `Dashboard.tsx`, `AssistantDashboard.tsx`
- React components: PascalCase, e.g. `Layout.tsx`, `shared.tsx` (shared multi-export files can be lowercase)
- UI primitives: lowercase noun, grouped by type: `button.tsx`, `inputs.tsx`, `card.tsx`, `controls.tsx`, `dialog.tsx`
- Server routes: lowercase plural noun, e.g. `entries.ts`, `assistants.ts`, `auth.ts`
- Server libs: lowercase noun, e.g. `email.ts`, `id.ts`
- Client libs: lowercase noun, e.g. `api.ts`, `utils.ts`, `activities.ts`
- Client stores: lowercase noun, e.g. `auth.ts`

**Functions:**
- camelCase for all functions: `makeToken()`, `tokenExpiry()`, `newId()`, `getWeekDates()`, `formatDate()`
- React components: PascalCase: `Dashboard`, `RequireAuth`, `AssistantAvatar`, `PageHeader`
- Event handlers: verb+noun pattern as inline arrow functions assigned directly to JSX props
- Async route handlers: inline anonymous `async (req, res) => {}` on each `router.METHOD()` call

**Variables:**
- camelCase throughout: `const jwtToken`, `const passwordHash`, `const weekDates`
- Boolean state flags: `isLoading`, `isFlexible`, `emailVerified`, `setupDone`
- Short loop/temp variables: `s` (sum accumulator), `e` (entry), `i` (index), `r` (response), `d` (request body)
- Constants: ALL_CAPS for static arrays: `DAY_NAMES`, `MONTHS`, `ACTIVITY_TYPES`

**Types/Interfaces:**
- PascalCase for all interfaces and exported types: `AuthState`, `AuthRequest`, `ActivityType`, `ButtonProps`
- Type aliases for domain enum strings: `type ReqStatus = "pending" | "approved" | "rejected"`
- `$inferSelect` used for Drizzle ORM type inference: `export type Profile = typeof profile.$inferSelect`
- Generic record type for loosely-typed API rows: `type Entry = Record<string, string | number | null | undefined>`

**Database:**
- Schema table objects: camelCase plural, e.g. `assistants`, `openSlots`, `emailVerifications`
- Column definitions: camelCase in JS, snake_case in DB string arg: `passwordHash: text("password_hash")`
- Enum objects: camelCase + `Enum` suffix: `reqStatusEnum`, `inviteStatusEnum`, `roleEnum`

## Code Style

**Formatting:**
- No Prettier or ESLint config detected. Code is consistently hand-formatted.
- Columns aligned with spaces for readability in multi-line object/import blocks:
  ```ts
  import Layout             from "@/components/Layout";
  import LoginPage          from "@/pages/Login";
  import SetupWizard        from "@/pages/SetupWizard";
  ```
- Inline type assertions preferred over multi-line generics where space permits.
- Single-line early returns on the same line as the condition (server routes):
  ```ts
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  ```

**TypeScript:**
- `strict: true` enabled in `client/tsconfig.json`
- Optional chaining used extensively: `e?.response?.data?.error`
- Nullish coalescing for defaults: `d.startTime ?? d.start_time`
- Explicit `as` type assertions used when API response shape is unknown

## Import Organization

**Order (client):**
1. React and React ecosystem (react, react-router-dom, @tanstack/react-query)
2. Internal store imports (`@/store/auth`)
3. Internal API imports (`@/lib/api`)
4. UI component imports (`@/components/ui/*`, `@/components/shared`)
5. Utility imports (`@/lib/utils`, `@/lib/activities`)
6. Icon imports (`lucide-react`)

**Order (server):**
1. Third-party libraries (express, bcryptjs, jsonwebtoken, etc.)
2. Internal DB (`../db`, `../db/schema`)
3. Internal middleware (`../middleware/auth`)
4. Internal lib (`../lib/email`, `../lib/id`)

**Path Aliases:**
- Client uses `@/*` alias mapping to `./src/*`, configured in `client/tsconfig.json` and `client/vite.config.ts`
- All client internal imports use `@/` prefix: `@/lib/api`, `@/components/ui/button`, `@/store/auth`

## Error Handling

**Server pattern — all route handlers wrapped in try/catch:**
```ts
router.post("/register", async (req, res) => {
  try {
    // ... logic
  } catch (e) { res.status(500).json({ error: String(e) }); }
});
```
- Errors serialized with `String(e)` — no stack traces exposed
- Business-logic errors return early with explicit HTTP status codes before the try/catch catches
- Email send failures caught and swallowed with `console.warn` rather than failing the request:
  ```ts
  try { await sendVerificationEmail(email, token); emailSent = true; } catch (e) { console.warn("⚠️  Email error:", e); }
  ```
- Some fire-and-forget email calls use empty catch: `try { await sendPasswordResetEmail(email, token); } catch {}`

**Client pattern — async form handlers:**
```ts
try {
  // ... api call
} catch (err: unknown) {
  const e   = err as { response?: { data?: { error?: string; code?: string } } };
  const msg = e?.response?.data?.error ?? "Something went wrong. Is the server running?";
  setError(msg);
} finally {
  setLoading(false);
}
```
- Axios 401 responses intercepted globally in `client/src/lib/api.ts` and redirect to `/login`

## Logging

**Framework:** `console` (no logging library)

**Patterns:**
- Server startup logs with emoji prefixes: `console.log("✅  Server running → ...")`
- Email warnings: `console.warn("⚠️  Email error:", e)`
- Main entry error: `main().catch(console.error)`
- No structured logging, no log levels

## Comments

**When to Comment:**
- Section separators using `// ── Label ──────` style for grouping route handlers and schema tables
- Inline comments on business logic that isn't self-evident: `// FK 3057/3059 is due the 5th of the 2nd month after the work month`
- Dev-only or temporary markers: `// always return in dev — harmless if email works`

**JSDoc/TSDoc:**
- Not used. No JSDoc comments found in the codebase.

## Function Design

**Size:**
- Route handlers are self-contained per route; complex pages (Dashboard, Hours) contain sub-components defined in the same file
- Utility functions in `client/src/lib/utils.ts` are small, single-purpose

**Parameters:**
- Server API objects use `Record<string, unknown>` when shape is flexible: `(data: Record<string, unknown>)`
- Component props use inline interface or destructured inline types: `{ name?: string; initials?: string; color?: string; size?: number }`

**Return Values:**
- Route handlers always call `res.json(...)` or `res.status(N).json(...)` — no implicit returns
- Client utility functions return typed primitives or `string[]`

## Module Design

**Exports:**
- Server routes: single default export of `Router` instance per file
- Client pages: single default export of the page component
- Client lib (`api.ts`): named exports grouped by domain (`authApi`, `profileApi`, `entriesApi`, etc.)
- UI components: named exports for all primitives; `displayName` set on forwarded-ref components
- Schema: named exports for every table object and all `$inferSelect` types

**Barrel Files:**
- Not used. Imports are direct file paths.

## React Patterns

**Data fetching:**
- TanStack Query (`useQuery`) for all read operations with `queryKey` arrays
- `useMutation` for write operations with `onSuccess` callbacks for blob downloads or cache invalidation
- `useQueryClient` for manual cache invalidation after mutations

**State management:**
- Zustand (`useAuthStore`) for global auth state, persisted to localStorage
- Local `useState` for all UI-specific state (form fields, dialogs, tabs, pagination)
- `useMemo` for derived/filtered data to avoid re-computation

**Route guards:**
- Wrapper components `RequireAuth`, `RequireGuardian`, `RequireAssistant`, `RequireSetup` in `client/src/App.tsx`
- Guards check Zustand store state, not server-side

**Component variants:**
- `cva` (class-variance-authority) used for variant-based styling on Button and Badge
- `cn()` utility (clsx + tailwind-merge) used for conditional class merging everywhere

---

*Convention analysis: 2026-04-06*
