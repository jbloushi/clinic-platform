# North Star — Clinic Operating Platform on OpenEMR

## Product Vision

A **modern, secure, flexible clinic operating system** for a medical clinic. Patients book and pay
online, the clinic runs its daily operations, and doctors run consultations — all through a premium
SaaS-grade interface (think Linear, Stripe Dashboard, Notion, Apple Health), while **OpenEMR remains
the healthcare/EMR source of truth** in the background.

This is a **medical clinic platform** — not a salon, spa, or generic booking site. Language, data,
and workflows are clinical: practitioners, encounters, diagnoses, prescriptions, vitals.

## The Three Portals

| Portal | Primary users | Essence |
|---|---|---|
| **Patient Portal** | Patients (public + logged in) | Find a doctor → book a slot → pay → manage appointments and records |
| **Clinic Operations Portal** | Reception, Admin, Finance | Calendar, patient directory, billing, providers, services, reports, settings |
| **Doctor Portal** | Doctors | Today's schedule, consultation workspace, patient chart, notes, prescriptions, orders |

## User Roles & Access

| Capability | Patient | Reception | Doctor | Admin | Finance |
|---|:-:|:-:|:-:|:-:|:-:|
| Book/cancel own appointments | ✅ | — | — | — | — |
| View own records/invoices/wallet | ✅ | — | — | — | — |
| Manage all appointments (any patient) | — | ✅ | own schedule | ✅ | — |
| Patient directory + demographics | — | ✅ | assigned patients | ✅ | read |
| Clinical chart (problems, meds, notes) | own (read) | — | ✅ | audit-only | — |
| Write encounters/prescriptions/orders | — | — | ✅ | — | — |
| Billing, payments, refunds, wallet adjust | — | collect | — | ✅ | ✅ |
| Providers, services, schedules config | — | — | own availability | ✅ | — |
| Users, roles, settings, reports | — | — | — | ✅ | reports |

No single super-admin flow: every portal route is guarded by role, and the BFF enforces role scopes
server-side (UI hiding is never the only barrier).

## Core Workflows

1. **New patient booking:** visit site → browse doctors (specialty/filter) → doctor profile with
   availability calendar → pick day + free slot → enter details + mobile number (OTP) → pay
   consultation fee → confirmation (message + booking record) → appointment appears in clinic
   calendar and doctor's schedule.
2. **Returning patient:** login via mobile number + OTP → sees appointments, records, invoices,
   wallet balance → rebooks in ~3 clicks.
3. **Clinic credit:** after a consultation, clinic grants credit (fixed amount or promo) → wallet
   balance with transaction history → applied at next checkout → admin can adjust with audit trail.
4. **Clinic operations:** reception manages the day calendar (walk-ins, reschedules, no-shows),
   checks patients in, collects/records payments; admin manages providers, services, schedules,
   users; finance reviews revenue and invoices.
5. **Doctor consult:** doctor opens today's schedule → opens consultation workspace for a patient →
   reviews chart (history, allergies, meds, vitals, labs) → writes encounter note → issues
   prescription / lab / imaging request → schedules follow-up.

## Technical Principles

1. **OpenEMR is the EMR source of truth** — clinical and scheduling data lives there (Phase 2+).
2. **Never modify OpenEMR core.** Integrate via REST/FHIR APIs; custom modules only if ever needed.
3. **One custom codebase, many environments** — the same UI runs against mock data, local OpenEMR,
   staging, or production purely by environment configuration.
4. **BFF adapter owns all OpenEMR access.** Browser ↔ Next.js server ↔ OpenEMR. No OpenEMR
   credentials or endpoints exposed to the browser.
5. **DataProvider abstraction** — UI calls repository functions; a mock provider and an OpenEMR
   provider implement the same interface.
6. **Platform-owned domains live in the adapter DB:** patient identity (mobile/OTP), wallet/credit
   ledger, booking-state machine, payment records.
7. Upgrade-safe, testable, typed (TypeScript end-to-end).

## Security Principles

- No secrets in frontend bundles; all `OPENEMR_*` and payment secrets are server-only env vars.
- HTTPS-ready deployment; OAuth2 tokens held server-side and never forwarded to the browser.
- Role-based access enforced in the BFF on every route.
- Audit-friendly: every write (booking, payment, wallet adjustment, clinical action) is attributable
  and logged **without PHI in log lines**.
- Mock data is 100% synthetic; production writes are gated by explicit env flags.
- Destructive actions (cancel, refund, delete) require confirmation and role checks.

## Environment Strategy

| Env | `APP_ENV` | Data source | Purpose |
|---|---|---|---|
| Local mock | `local` | `USE_MOCK_DATA=true` | UI development + demo, zero OpenEMR needed |
| Local integrated | `local` | local OpenEMR (Docker/XAMPP) | Integration development |
| Staging | `staging` | staging OpenEMR VPS | Pre-production validation |
| Production | `production` | production OpenEMR VPS | Live clinic |

See [.env.example](../.env.example) for the exact variable split (public vs server-only).

## OpenEMR Integration Strategy (summary)

- **REST API** (`/apis/default/api`) for scheduling + admin writes: patients, appointments,
  facilities, insurance. Appointments support create/read/update/search.
- **FHIR R4 API** (`/apis/default/fhir`) for clinical reads: conditions, allergies, medications,
  observations/vitals, documents, coverage.
- **Adapter logic** for what OpenEMR lacks: free-slot computation, mobile-OTP identity, wallet,
  payment checkout, booking state machine.
- Full rationale in [ADR-0001](ADR-0001-openemr-integration-strategy.md); facts in
  [OPENEMR_DISCOVERY.md](OPENEMR_DISCOVERY.md).

## Demo Scope (Phase 1) vs Production Scope

**Demo (mock mode, no OpenEMR):** all three portals with the pages listed in
[UI_INFORMATION_ARCHITECTURE.md](UI_INFORMATION_ARCHITECTURE.md); full booking flow with mock OTP +
mock payment; wallet ledger; seeded synthetic clinic (doctors, patients, appointments, encounters).

**Production path (Phases 2–3):** real OpenEMR provider, real payment gateway, client_credentials
auth, TLS, audit logs, backups, monitoring/error tracking, consent forms, retention policy,
insurance flows, Arabic/RTL localization.
