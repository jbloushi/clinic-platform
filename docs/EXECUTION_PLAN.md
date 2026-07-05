# Execution Plan

Phases are strictly ordered; each task lists dependencies and acceptance criteria (AC).
Complexity: S (<½ day), M (~1 day), L (multi-day) for a competent agent.

## Recommended file structure (target repo layout)

```
D:\projects\openEMR\
├─ docs/                      # this planning set (exists)
├─ poc/                       # planning-phase proofs (exists; superseded by app/ once built)
└─ app/                       # Next.js application (created in Phase 1, Task 1.1)
   ├─ src/
   │  ├─ app/
   │  │  ├─ (patient)/        # /, /doctors, /doctors/[id], /book/*, /login, /account/*
   │  │  ├─ (ops)/ops/…       # dashboard, calendar, patients, billing, providers, services, reports, users, settings
   │  │  ├─ (doctor)/doctor/… # dashboard, schedule, consult/[id], patients/[id], encounters, prescriptions, labs, imaging, followups
   │  │  └─ api/              # route handlers (BFF): auth/, bookings/, payments/, wallet/
   │  ├─ components/ui/       # shadcn primitives
   │  ├─ components/domain/   # AppShell, DataTable, CalendarView, StatusBadge, …
   │  ├─ lib/
   │  │  ├─ data/             # types.ts, provider.ts (interface), index.ts (env-based factory)
   │  │  │  ├─ mock/          # mock-provider.ts + seed data (JSON/TS)
   │  │  │  └─ openemr/       # openemr-provider.ts, client.ts (OAuth2+fetch), mappers.ts, slots.ts
   │  │  ├─ auth/             # sessions, OTP, role guards
   │  │  ├─ wallet/           # ledger service
   │  │  ├─ booking/          # status machine + validation
   │  │  └─ payments/         # PaymentProvider interface + mock provider
   │  └─ prisma/schema.prisma # platform DB (identity, booking, wallet, payment, audit)
   └─ .env.local              # from ../.env.example
```

---

## Phase 0 — Repo & planning scaffold ✅ (this session)

Docs, `.env.example`, `poc/` interface + mock sample, git init.

## Phase 1 — Mock-mode demo (no OpenEMR required)

| # | Task | Deps | Size | Acceptance criteria |
|---|---|---|---|---|
| 1.1 | Scaffold `app/` — `create-next-app` (TS, App Router, Tailwind), add shadcn/ui, TanStack Query, react-hook-form+zod, Prisma(SQLite), lucide | — | S | `npm run dev` serves; `npm run build` and `tsc --noEmit` pass |
| 1.2 | Design tokens + primitives: Tailwind theme (colors per UI_IA visual direction), shadcn components, fonts | 1.1 | S | Tokens as CSS vars; a `/styleguide` dev page renders all primitives |
| 1.3 | Data layer: move `poc/data-provider.interface.ts` types into `lib/data/types.ts` + `provider.ts`; env-based factory; **MockProvider** with seeded synthetic clinic (≥6 doctors across specialties, ≥25 patients, 2 weeks of appointments, encounters/problems/meds/vitals per patient, services catalog) | 1.1 | M | All repository functions return realistic data; seed is deterministic; zero UI imports from `mock/` directly |
| 1.4 | Platform DB + auth: Prisma schema (patient_identity, staff_user, booking, wallet, wallet_transaction, payment, audit_log); session cookies; mock OTP (`123456`); role guards per route group | 1.1 | M | Patient can register/login by mobile; staff demo logins per role; guards block cross-portal access (server-side) |
| 1.5 | AppShell + navigation for all three portals (role-aware sidebar, topbar, breadcrumbs) | 1.2, 1.4 | M | Each portal shell renders with correct nav; responsive; RTL-safe (logical props) |
| 1.6 | **Patient booking flow end-to-end**: Home → Find Doctor → Doctor Profile (calendar + slots from `getAvailableSlots`) → Book stepper → OTP login → Checkout (mock pay + wallet apply) → Confirmation → My Appointments | 1.3–1.5 | L | Complete flow works with keyboard; booking persists with status machine (`held→pending_payment→confirmed`); slot disappears from availability; cancel/reschedule works |
| 1.7 | Wallet module: ledger service, balance derivation, expiry handling, admin adjustment + history UI (patient profile + ops patient page) | 1.4 | M | Credit grant → visible balance → applied at checkout → immutable transaction history; adjustments audited |
| 1.8 | Ops portal pages: Dashboard, Calendar (day/week by provider, create/move/cancel/walk-in/no-show), Patients + Profile, Billing, Providers (+availability editor), Services, Users, Settings, Reports-lite | 1.5, 1.6 | L | Reception can run a full clinic day in mock mode; every table has loading/empty/error states |
| 1.9 | Doctor portal pages: Dashboard, Today's Schedule, Consultation Workspace (chart rail + note + mock orders), Patient Chart, Encounters, Prescriptions, Labs, Imaging, Follow-ups | 1.5, 1.3 | L | Doctor completes a consult: open from schedule → review chart → save note → issue mock Rx/lab → book follow-up |
| 1.10 | Polish + demo pass: seed reset script, `npm run demo`, lighthouse/a11y sweep, README run instructions | all | S | Fresh clone → `npm i && npm run demo` → working demo; no console errors; AA contrast |

**Phase 1 exit:** full three-portal demo on mock data, `USE_MOCK_DATA=true`, no OpenEMR anywhere.

## Phase 2 — OpenEMR integration

| # | Task | Deps | Size | Acceptance criteria |
|---|---|---|---|---|
| 2.1 | Local OpenEMR up: Docker compose (primary; base on official `docker/` examples) or XAMPP per OPENEMR_DISCOVERY §1; enable REST+FHIR APIs; create restricted API user; register OAuth2 client | P1 | M | `GET /apis/default/api/patient` succeeds with a token from `/oauth2/default/token` |
| 2.2 | OpenEMR client (`lib/data/openemr/client.ts`): token acquisition/refresh/caching, error normalization, `ALLOW_WRITES` guard | 2.1 | M | Unit-tested token lifecycle; writes blocked when `ALLOW_WRITES=false` |
| 2.3 | `OpenEMRProvider` — REST: patients, practitioners, facilities, appointments (CRUS), encounters + mappers to domain types | 2.2 | L | Booking flow from Phase 1 runs unchanged against local OpenEMR by flipping env only |
| 2.4 | `OpenEMRProvider` — FHIR clinical reads: Condition, AllergyIntolerance, MedicationRequest, Observation (vitals+labs), DocumentReference → patient chart + records pages | 2.2 | L | Doctor chart + patient records show real OpenEMR data |
| 2.5 | Slot computation (`lib/data/openemr/slots.ts`): provider availability events + booked appointments → free slots; conflict re-check before create | 2.3 | M | No double-booking under a scripted concurrent test; slots match OpenEMR calendar |
| 2.6 | Contract tests: recorded-fixture tests for every OpenEMR call; env-switch smoke test (mock ↔ local) | 2.3–2.5 | M | CI-runnable without a live instance (fixtures); switch test passes |

## Phase 3 — Production hardening & future scope

Real payment gateway behind `PaymentProvider` (regional choice needs approval — DECISION_LOG);
client_credentials+JWKS auth switch; staging + production env rollout (TLS, secrets management);
audit-log UI; backups/retention policy; monitoring + error tracking (e.g. Sentry) with PHI-safe
scrubbing; consent forms; insurance flows (REST insurance + FHIR Coverage); OpenEMR billing sync
for payments; prescriptions/orders writing (custom module decision); Arabic/RTL localization;
notifications (SMS/email confirmations).

## Safe order of execution

1.1 → 1.2 → 1.3 → 1.4 → 1.5 → **1.6 (the spine — do before wide portal buildout)** → 1.7 →
1.8 ∥ 1.9 → 1.10 → 2.1 … Phase 2 strictly after Phase 1 exit; Phase 3 items independent, approval-gated.

## Global acceptance rules (apply to every task)

- `tsc --noEmit`, lint, and build pass after every task.
- UI never imports `mock/` or `openemr/` directly — only `lib/data` factory.
- No `NEXT_PUBLIC_` secret. No PHI in logs. No OpenEMR core modifications, ever.
- Every list/detail surface has loading, empty, and error states.
- Commit per task with descriptive message.
