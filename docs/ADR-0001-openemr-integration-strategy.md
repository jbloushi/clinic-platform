# ADR-0001 — OpenEMR Integration Strategy

**Status:** Accepted · **Date:** 2026-07-05 · **Deciders:** Lead Architect (planning phase)

## Context

We are building a three-portal clinic platform (Patient / Clinic Ops / Doctor) with a modern SaaS
UX. OpenEMR v8.0 is the EMR source of truth. Discovery ([OPENEMR_DISCOVERY.md](OPENEMR_DISCOVERY.md))
confirmed: a capable OAuth2-protected REST API (appointments CRUS), a certified FHIR R4 API (rich
clinical reads), a sanctioned custom-module extension point, and three gaps we must own — free-slot
computation, mobile-OTP patient identity, and a credit/wallet model. Constraints: never modify
OpenEMR core, no secrets in the browser, one codebase across mock/local/staging/production.

## Decision

**Next.js 15 (App Router, TypeScript) application whose server side acts as the BFF/adapter.**

```
Browser (React UI — no secrets)
   │  session cookie (our auth)
   ▼
Next.js server (route handlers + server actions)   ←  the ONLY holder of OpenEMR credentials
   ├─ AuthN/AuthZ: patient mobile+OTP sessions; staff role sessions
   ├─ DataProvider: MockProvider | OpenEMRProvider (env-selected)
   ├─ Platform DB (Prisma; SQLite demo → Postgres prod):
   │     patient_identity, booking, wallet, wallet_transaction, payment, audit_log
   └─ OpenEMR client (OAuth2 token mgmt, retries, mapping)
        ├─ REST  /apis/default/api   → patients, appointments, practitioners, facilities, insurance
        └─ FHIR  /apis/default/fhir  → Condition, AllergyIntolerance, MedicationRequest,
                                       Observation, DocumentReference, Coverage…
              ▼
        OpenEMR 8.0 → MariaDB
```

## Options Considered

| Option | Verdict | Why |
|---|---|---|
| **A. Next.js UI + Next.js API routes as BFF** | ✅ **Chosen** | One deployable, one language, server-only secrets, first-class env switching, fastest path to premium UX |
| B. Next.js UI + FastAPI adapter | ❌ | Second runtime/deploy/CI for zero capability gain at this scale; Python offers nothing OpenEMR-specific |
| C. Separate SPA + Node gateway | ❌ | Same as A but with more moving parts and CORS/session complexity |
| D. Build UI inside OpenEMR (themes/modules) | ❌ | Locks UX to legacy stack; violates the "modern SaaS product" north star |

Escape hatch: because all OpenEMR access is confined to the `OpenEMRProvider` + one HTTP client
module, extracting the adapter into a standalone service later (option B/C) is a refactor, not a
rewrite.

## Auth Strategy

Two independent auth planes:

1. **End-user ↔ our platform:** our own sessions (HTTP-only cookies).
   - Patients: mobile number + OTP (mock OTP `123456` in demo; SMS provider later). Identity row maps to OpenEMR patient UUID.
   - Staff (reception/doctor/admin/finance): email+password with role claims in demo; SSO later.
2. **Our server ↔ OpenEMR:** OAuth2 service connection, tokens cached server-side, auto-refresh.
   - **Demo:** `password` grant with a dedicated, least-privileged OpenEMR API user (grant must be enabled in OpenEMR globals). Server-side only.
   - **Production (required before staging):** `client_credentials` with registered JWKS (`system/*` scopes). Flagged in [DECISION_LOG.md](DECISION_LOG.md) D4 as needing the switch.
   - Requested scopes are minimal and enumerated in [.env.example](../.env.example) comments.

The browser never sees OpenEMR URLs, tokens, or credentials.

## API Strategy

| Concern | Channel | Notes |
|---|---|---|
| Patients (create/read/search) | REST `patient` | Registration writes on booking |
| Appointments (create/update/search) | REST `appointment` | Booking core; status updates for check-in/cancel/no-show |
| Practitioners, facilities | REST | Directory + profiles |
| Encounters (list/read) | REST `encounter` + FHIR `Encounter` | |
| Clinical chart (problems, allergies, meds, vitals, labs, docs) | FHIR | Condition, AllergyIntolerance, MedicationRequest, Observation, DiagnosticReport, DocumentReference |
| **Free slots** | **Adapter computation** | Fetch provider availability events + booked appointments from `pc_event` via REST for a date window; subtract; slice by service duration; **re-validate conflicts immediately before create** (mitigates race, see risk R1) |
| Patient identity, wallet, payments, booking states | Platform DB | Not OpenEMR concerns |
| Prescriptions / lab / imaging orders | Phase 1 mock; Phase 2 read-only via FHIR | Order *writing* stays in OpenEMR UI until a custom module is justified |

## Environment Strategy

Single codebase; behavior controlled by env only. `APP_ENV` ∈ `local|staging|production`;
`USE_MOCK_DATA` picks the provider; `OPENEMR_*` vars point at the target instance;
`ALLOW_WRITES=false` guards accidental writes against real instances. Public (`NEXT_PUBLIC_*`)
vars carry no secrets. Full matrix in [.env.example](../.env.example).

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Slot race → double booking | Conflict re-check just before appointment create; single-writer demo; future custom-module atomic hold |
| Password grant leaks / prod misuse | Server-only env, restricted API user, hard requirement to switch to client_credentials pre-staging |
| OpenEMR upgrade changes API | Pin tested version; all calls behind one client; Phase 2 contract tests |
| PHI in logs / mock data | Synthetic mock data only; log redaction rule; no PHI in error messages |
| Wallet vs EMR billing divergence | Append-only ledger, reconciliation job designed (deferred) |
