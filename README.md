# Clinic Platform on OpenEMR

A modern clinic operating system — **Patient Portal**, **Clinic Operations Portal**, and **Doctor
Portal** — with a premium SaaS UX, powered by OpenEMR 8.0 as the healthcare/EMR source of truth.

**Status:** planning phase complete; Phase 1 (mock-mode demo) ready for implementation.

## Architecture in one line

Browser → Next.js UI → Next.js server (BFF adapter: auth, wallet, booking state, OpenEMR client)
→ OpenEMR REST/FHIR APIs → MariaDB. OpenEMR is never modified; secrets never reach the browser;
the same codebase targets mock / local / staging / production via env config only.

## Read these, in order

1. [docs/NORTH_STAR.md](docs/NORTH_STAR.md) — vision, roles, portals, principles, scope
2. [docs/OPENEMR_DISCOVERY.md](docs/OPENEMR_DISCOVERY.md) — verified OpenEMR facts (install, APIs, auth, data model, risks)
3. [docs/ADR-0001-openemr-integration-strategy.md](docs/ADR-0001-openemr-integration-strategy.md) — architecture decision + rationale
4. [docs/DECISION_LOG.md](docs/DECISION_LOG.md) — all decisions, confidence, what needs approval
5. [docs/UI_INFORMATION_ARCHITECTURE.md](docs/UI_INFORMATION_ARCHITECTURE.md) — every portal, page, component, data mapping, phase
6. [docs/EXECUTION_PLAN.md](docs/EXECUTION_PLAN.md) — phased tasks with acceptance criteria
7. [docs/NEXT_AGENT_PROMPT.md](docs/NEXT_AGENT_PROMPT.md) — **start here to build Phase 1**

## Repo layout

```
docs/   planning documents (authoritative)
poc/    typed DataProvider contract + mock data sample (planning-phase proof)
app/    Next.js application (created in Phase 1, Task 1.1 — does not exist yet)
```

`.env.example` at the root defines the full environment variable contract (public vs server-only).

## Quick facts

- OpenEMR 8.0.x: PHP ≥ 8.2, MariaDB 10.6–11.8; local install works via Docker (recommended) or
  XAMPP on Windows (validated, non-Docker). Not needed at all for the Phase 1 mock-mode demo.
- Demo logins (Phase 1): patient = any mobile + OTP `123456`; staff = seeded role accounts.
