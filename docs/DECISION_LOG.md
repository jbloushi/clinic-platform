# Decision Log

Confidence rule: ≥90% → decided and proceed; <90% → recommendation recorded with alternatives and
what needs approval. Do **not** re-litigate `Decided` rows in later phases.

| # | Decision | Confidence | Status | Reason | Alternatives considered |
|---|---|---|---|---|---|
| D1 | **Next.js 15 (App Router, TypeScript): frontend + API routes/server actions as the BFF adapter** — single deployable | 95% | Decided | One runtime, server-only secrets, native env switching, best DX for a SaaS-grade UI | FastAPI adapter (second runtime, no gain at this scale); separate Node gateway (same, more ops); building UI inside OpenEMR (locks us to legacy UI) |
| D2 | **`DataProvider` interface with `MockProvider` and `OpenEMRProvider`**, selected by env; UI only imports repository functions | 95% | Decided | UI never knows the data source → mock/local/staging/prod by config only | Direct fetch calls in pages (couples UI to OpenEMR); GraphQL layer (overkill) |
| D3 | **REST API for scheduling/admin writes; FHIR for clinical reads** | 90% | Decided | REST appointments support CRUS; FHIR is richest/most standard for clinical data | FHIR-only (Appointment write coverage thin); REST-only (clinical shapes poorer) |
| D4 | **Demo OpenEMR auth = OAuth2 password grant** with dedicated restricted API user, server-side only | 85% | Recommended — prod switch needs approval | Simplest working server-to-server path for a demo; explicitly flagged as not production-grade | client_credentials + JWKS (production path — required before staging/prod); authorization_code per staff user (needed later if staff log into OpenEMR through our UI) |
| D5 | **Patient identity (mobile + OTP) lives in our adapter DB**, mapped to OpenEMR patient UUID; OTP mocked in demo | 90% | Decided | OpenEMR has no mobile-OTP auth; portal auth is username/password | Extending OpenEMR portal auth (core modification — forbidden); external IdP like Auth0 (adds cost/dependency for demo, viable later) |
| D6 | **Clinic credit/wallet = ledger tables in adapter DB** (`wallet_transaction` append-only; balance derived) | 90% | Decided | No clean fit in OpenEMR billing; ledger gives history, expiry, adjustment, audit for free | OpenEMR billing misuse (fragile, upgrade-risky); custom OpenEMR module (heavier, later option if clinic wants credit visible inside OpenEMR) |
| D7 | **Demo booking flow: hold slot → details → (mock) pay → confirmed**, modeled as a status machine (`draft → held → pending_payment → confirmed → completed / cancelled / no_show`) | 90% | Decided | Status machine makes pay-later, manual confirm, walk-in, doctor-approval variants configuration, not rework | Pay-first-then-create (risks orphan payments); create-unpaid-then-chase (weak default for online booking) |
| D8 | **Never modify OpenEMR core; API integration only**; future needs go into `interface/modules/custom_modules/` | 99% | Decided | Upgrade safety, supportability | Forking OpenEMR (permanent maintenance burden) |
| D9 | **UI stack: Tailwind CSS + shadcn/ui + lucide-react; TanStack Query/Table; react-hook-form + zod** | 90% | Decided | Fastest route to a premium, accessible, consistent SaaS look; RTL-capable | MUI/Ant (heavier, less "Linear/Stripe" aesthetic); custom CSS system (slower) |
| D10 | **Dev OpenEMR instance via Docker compose primarily; XAMPP as validated non-Docker fallback** | 85% | Recommended | PHP extension burden makes Docker far lower friction; both documented | XAMPP-only (validated but riskier); cloud sandbox (needs infra) |
| D11 | **Adapter DB: SQLite (via Prisma) for demo → Postgres for production**, same schema | 88% | Recommended | Zero-setup demo; Prisma makes the swap a connection-string change | Postgres-from-day-1 (heavier local setup); storing platform data in OpenEMR MariaDB (couples lifecycles) |
| D12 | **Payments behind a `PaymentProvider` interface; demo uses `mock` provider** | 92% | Decided | Keeps architecture payment-model agnostic (Stripe/Tap/HyperPay/manual later) | Hardwiring Stripe now (premature for Gulf-market gateway choice) |

## Needs future approval (before staging/production)

1. Switch OpenEMR auth from password grant to **client_credentials + JWKS** (D4).
2. Choice of **real payment gateway** (regional: Tap, HyperPay, Stripe availability) (D12).
3. Whether wallet should eventually sync into OpenEMR billing or stay platform-only (D6).
4. Managed Postgres choice + backup policy for the adapter DB (D11).
