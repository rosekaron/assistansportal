---
name: Implement design wireframes from Anthropic design file
type: seed
status: idea
trigger: when guardian decides to refresh the UI based on the design wireframes
captured: 2026-04-25
captured_by: guardian (paused mid-session 2026-04-25, immediately after v1.0.1 PR #7 merged)
target_milestone: TBD (likely after v1.0.2 hardening; could be its own UI-refresh milestone)
priority: TBD
---

# Implement Design Wireframes (Anthropic Design File)

## What this is

A future milestone (or focused phase) to fetch a design file hosted on Anthropic's design service, read the README within, and implement the relevant UI aspects — specifically the `wireframes/index.html` deliverable.

## The source

```
https://api.anthropic.com/v1/design/h/XrLN5KjfIuyYishailNkRg?open_file=wireframes%2Findex.html
```

**Implementation target inside the design file:** `wireframes/index.html`

## Workflow when this seed is picked up

1. **Fetch the design file.** Use `WebFetch` (or the `mcp__firecrawl` / `mcp__exa` tools if surface analysis is needed) to retrieve the design package metadata + the `wireframes/index.html` content + any README.

2. **Read the README first.** The design file is expected to ship with a README explaining intent, structural choices, component breakdown, and which parts of the package are normative vs. illustrative. Read this top-to-bottom before any implementation.

3. **Identify the relevant aspects.** Not everything in the design package will apply to Kalinga. Map the design's components/screens/flows to the existing Kalinga IA (Home, Monthly, Records, Settings, AssistantDashboard). Note what's:
   - Direct lift (e.g., the design's settings layout maps cleanly onto current `Settings.tsx`)
   - Adaptation (the design's component patterns apply but need to be re-sized for Swedish labels + the FK/SKV form realities)
   - Out of scope for this implementation pass (e.g., illustrative mockups for features Kalinga doesn't have yet)

4. **Plan the implementation as a phase (or set of phases).** Recommended GSD flow:
   - `/gsd-discuss-phase` to capture decisions on scope (which screens/components to implement, what level of fidelity, what to defer)
   - `/gsd-ui-phase` to produce a UI-SPEC.md design contract — pulls in the wireframes verbatim as reference + sets a 6-pillar quality bar
   - `/gsd-plan-phase --reviews` if the implementation spans more than 2 phases

5. **Implement against the existing component library.** Kalinga uses shadcn/ui + Tailwind + React 18. Don't rewrite the component primitives; map the design's intent onto the existing primitives.

## Why this is a seed (not active work today)

- v1.0.1 just shipped (2026-04-25). The repo has unfinished follow-ups already queued (the v1.0.2 hardening backlog from CodeRabbit's PR #7 review).
- Implementing a full design refresh on top of fresh code is a context-heavy effort that benefits from a clean session.
- Guardian flagged this as "future milestone" framing — explicitly not a now-task.
- The design file itself may evolve between now and pickup; fetching at pickup time avoids working from a stale snapshot.

## Open questions for pickup

1. Is the design package authoritative, or a reference to inspire? (Determines fidelity vs. interpretation latitude.)
2. Does the design assume features Kalinga doesn't have yet (e.g., team views, B2B operator surfaces, etc.)?
3. Should this be a milestone of its own (e.g., `v1.1 — Design refresh`), or absorbed into the next functional milestone as a UI sweep across affected pages?
4. Any prior commitments to specific pages where guardian has strong opinions vs. pages that are open to redesign?

## When to pick this up

The trigger is guardian-initiated — there's no functional dependency. Reasonable timing:
- After v1.0.2 hardening ships (so the codebase is on solid footing before redesign work churns it)
- Before any major user-facing growth (so the polished UI is what new users encounter)
- If the design file gets updated with new wireframes/components that block other work
- Whenever guardian feels the current UI is the highest-leverage thing to improve next

## Reference docs to consult at pickup

- `.planning/PROJECT.md` — core value, who the users are, what they need
- `.planning/ROADMAP.md` — current milestone state
- `client/src/components/ui/` — existing shadcn/ui primitives
- `client/src/pages/{Home,Monthly,Records,Settings,AssistantDashboard}.tsx` — current page implementations
- The fetched README inside the design package — read FIRST, before any implementation

---

*Seed captured 2026-04-25 immediately post-v1.0.1 ship. No work begun.*
