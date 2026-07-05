# Execution Prompt — Phase 1 Build Agent

You are implementing Phase 1 (mock-mode demo) of a clinic platform. The architecture is **settled**.
Read this file, then [EXECUTION_PLAN.md](EXECUTION_PLAN.md) and
[UI_INFORMATION_ARCHITECTURE.md](UI_INFORMATION_ARCHITECTURE.md). Consult
[OPENEMR_DISCOVERY.md](OPENEMR_DISCOVERY.md) only if an OpenEMR question arises — do **not**
re-research OpenEMR, and do **not** re-litigate anything in [DECISION_LOG.md](DECISION_LOG.md).

## Settled decisions (summary — do not revisit)

- **Stack:** Next.js 15, App Router, TypeScript, Tailwind + shadcn/ui + lucide-react, TanStack
  Query/Table, react-hook-form + zod, Prisma + SQLite (platform DB). App lives in `app/`.
- **Architecture:** Next.js server = BFF adapter. UI calls repository functions from `lib/data`
  only. `DataProvider` interface with `MockProvider` (Phase 1) and `OpenEMRProvider` (Phase 2 —
  create the folder + stub, do not implement).
- **Domain model & function signatures:** already defined in
  [poc/data-provider.interface.ts](../poc/data-provider.interface.ts) — move into
  `app/src/lib/data/types.ts` + `provider.ts` and implement against it. Extend if needed; don't
  redesign.
- **Booking:** status machine `draft → held → pending_payment → confirmed → completed | cancelled | no_show`.
  Demo flow: hold slot → details → mock pay → confirmed.
- **Auth:** patients = mobile + OTP (mock OTP `123456`); staff = seeded demo accounts per role
  (reception, doctor, admin, finance). HTTP-only cookie sessions. Role guards server-side per
  route group.
- **Wallet:** append-only `wallet_transaction` ledger in Prisma; balance always derived, never
  stored as a mutable number.
- **Payments:** `PaymentProvider` interface, `mock` implementation only.
- **Product identity:** this is a **medical clinic** — specialties, practitioners, encounters,
  diagnoses, prescriptions, vitals. Never use salon/spa/beauty/luxury wording in UI copy, mock
  data, or code names.

## Your tasks (in order — from EXECUTION_PLAN Phase 1)

1.1 Scaffold `app/` → 1.2 tokens + primitives + `/styleguide` → 1.3 data layer + MockProvider with
seeded synthetic clinic → 1.4 platform DB + auth + role guards → 1.5 AppShells/nav →
**1.6 patient booking flow end-to-end** → 1.7 wallet → 1.8 ops portal pages → 1.9 doctor portal
pages → 1.10 polish + demo script.

Each task's acceptance criteria are in EXECUTION_PLAN.md — meet them before moving on, commit per
task.

## Mock data requirements (task 1.3)

Deterministic seed, fully synthetic (no real names/phones/MRNs): ≥6 doctors across specialties
(Internal Medicine, Cardiology, Pediatrics, Dermatology, Orthopedics, ENT) with photos-placeholder,
bios, fees, weekly availability; ≥25 patients with demographics, problems (ICD-style labels),
allergies, medications, vitals history, 1–4 past encounters with notes; 2 weeks of appointments in
mixed statuses; services catalog (new consult, follow-up, procedures) with durations + fees; a few
wallet balances with transaction history.

## Do NOT

- Do not modify, clone, or vendor OpenEMR into this repo (an `openemr/` dir is gitignored on purpose).
- Do not implement `OpenEMRProvider`, OAuth flows, or real OTP/SMS/payments — Phase 2/3.
- Do not add real secrets or production URLs anywhere; use [.env.example](../.env.example) names.
- Do not import from `lib/data/mock/` in any component — only via the `lib/data` factory.
- Do not put secrets in `NEXT_PUBLIC_*`, PHI in logs, or hard-coded hex colors in components.
- Do not add extra frameworks/state libraries (no Redux, no MUI, no axios — fetch + TanStack Query).
- Do not rewrite the docs in `docs/` — update only if you find a factual error, noting it in DECISION_LOG.

## Definition of done (Phase 1)

Fresh clone → `cd app && npm install && npm run demo` → all three portals work on mock data:
a patient books, pays (mock), gets confirmation, sees the appointment; reception runs the day
calendar and adjusts a wallet; a doctor completes a consult with note + mock prescription and books
a follow-up. `tsc --noEmit`, lint, and `npm run build` all pass. No console errors. Loading/empty/
error states everywhere. AA contrast.

## Token-efficiency instructions

Work task-by-task; don't read the whole repo repeatedly. The docs in `docs/` are authoritative —
prefer them over exploration. Don't paste large file contents into your reasoning; reference paths.
When a decision is ambiguous, pick the option consistent with DECISION_LOG and note it in one line
in DECISION_LOG.md rather than asking.
