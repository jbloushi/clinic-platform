# OpenEMR Discovery Report

> Findings verified against `openemr/openemr` master + v8.0 release line (July 2026).
> This document is the factual foundation for all architecture decisions. The next agent should
> trust this document instead of re-researching OpenEMR.

## 1. Version & Installation

| Item | Finding |
|---|---|
| Current release | **v8.0.x** (latest tag `v8_0_0_3`, Mar 2026) |
| PHP | **≥ 8.2 required** (8.2–8.5 supported); composer platform pinned to 8.2 |
| Database | **MariaDB 10.6–11.8 recommended**; MySQL 5.7–8.4 supported. Project recommends MariaDB for production |
| Web server | Apache typical (mod_php or FPM); Nginx works with manual config |
| PHP extensions | Large list incl. `mysqli`, `pdo_mysql`, `gd`, `intl`, `mbstring`, `openssl`, `sodium`, `curl`, `xml*`, `xsl`, `zip`, `soap`, `ldap`, `calendar`, `bcmath` (some like `imagick`/`redis` optional) |
| Node/Composer | **Only needed when building from git source** (`composer install`, `npm install`, `npm run build`, Node 24.x). **Release zip/tarball ships pre-built — no build step** |

### Can it be installed locally without Docker?

**Yes — feasible and officially documented.** The OpenEMR wiki has a dedicated
"OpenEMR 8.0.0 Windows Installation" guide using **XAMPP** (Apache + MariaDB + PHP):

1. Install XAMPP with a PHP 8.2+ build.
2. Download the OpenEMR 8.0.0 **release zip** (not git source), unblock the zip on Windows.
3. Extract, rename folder to `openemr`, move into `\xampp\htdocs\`.
4. Browse to `http://localhost/openemr` — the web setup wizard **auto-creates the database**.
5. Post-install: set file permissions, enable APIs (see §3).

### Local installation risks (non-Docker)

- **PHP extension gaps** — XAMPP builds may miss extensions (`intl`, `sodium`, `ldap`); must enable in `php.ini`.
- **PHP version drift** — XAMPP may bundle a PHP outside 8.2–8.5; verify before installing.
- **OAuth2 requires HTTPS or `localhost`** — the OAuth2 server refuses non-TLS remote origins. Fine locally; staging/production must have TLS.
- **php.ini tuning** — OpenEMR requires raised `memory_limit`, `max_input_vars`, `post_max_size`, etc. (setup wizard flags these).
- Windows file-permission and path-length quirks are occasionally reported.

### Recommended dev setup

**Docker is the primary recommendation** (`openemr/openemr:8.0` image + MariaDB via docker-compose;
official `docker/` directory in-repo has production and development compose files). It eliminates
the PHP-extension burden entirely. XAMPP is the validated non-Docker fallback.
**Phase 1 of our platform needs no OpenEMR at all** (mock mode), so OpenEMR install is a Phase 2 task.

## 2. Repository Structure (what matters to us)

| Path | Purpose | Touch? |
|---|---|---|
| `apis/` | REST + FHIR API entry/dispatch | Read-only reference |
| `oauth2/` | OAuth2/OIDC server endpoints | Read-only reference |
| `src/` | Modern namespaced PHP (`OpenEMR\…`): services, validators, **event dispatcher** | Read-only reference |
| `interface/` | Legacy clinician UI (thousands of PHP screens) | **Never modify** |
| `interface/modules/custom_modules/` | **Sanctioned extension point.** Ships 7 real examples: `oe-module-comlink-telehealth`, `oe-module-faxsms`, `oe-module-ehi-exporter`, `oe-module-prior-authorizations`, `oe-module-weno`, `oe-module-dorn`, `oe-module-dashboard-context` | Safe place for a future custom module |
| `portal/` | Built-in patient portal (separate auth, separate Portal API) | Not used by us (we replace it) |
| `sites/` | Per-tenant config + uploaded documents (`sites/default/`) | Instance data, upgrade-safe |
| `sql/` | Schema + upgrade scripts | Read-only reference for data model |
| `templates/` | Twig templates (newer screens) | Never modify |
| `swagger/` | OpenAPI/Swagger definitions for the standard API | Use to generate/verify our client |
| `docker/`, `ci/` | Official Docker + CI configs | Reference for our dev compose |

**Upgrade-sensitive:** everything except `custom_modules/` and `sites/`. Any core edit breaks the
upgrade path — hence our hard rule: **integrate via APIs only**.

## 3. Authentication

- **Enablement:** Administration → Config → Connectors → check *Enable OpenEMR Standard REST API* (and *FHIR REST API*). Site address must be set correctly; OAuth2 requires HTTPS or localhost.
- **OAuth2/OIDC server** at `https://{host}/oauth2/{site}/` (site = `default` normally):
  - **Dynamic client registration:** `POST /oauth2/default/registration` (app name, redirect URIs, scopes) → returns `client_id` (+ `client_secret` for confidential clients).
  - **Token endpoint:** `POST /oauth2/default/token`.
- **Grant types:**
  | Grant | Use | Notes |
  |---|---|---|
  | `authorization_code` (+PKCE) | Interactive user login (SMART apps) | PKCE required for public clients |
  | `refresh_token` | Session continuation | |
  | `password` | Direct user+client credential exchange | **Disabled by default; must enable in globals.** Acceptable for a server-side demo adapter; flagged as not for production |
  | `client_credentials` | Backend system-to-system | Requires registered **JWKS** (asymmetric keys); the production-grade path for our adapter |
- **Scopes:** granular `.cruds` syntax — `c`reate `r`ead `u`pdate `d`elete `s`earch. Contexts: `user/` (clinic user), `patient/` (patient-restricted), `system/` (backend). E.g. `user/Patient.rs`, `user/appointment.cru`, `system/Patient.rs`. Legacy `.read/.write` still accepted, deprecated.
- **Users & roles:** clinic users live in `users` table; authorization via built-in ACL (gacl) + scope filtering at the API layer. API requests execute in the context of the authenticated user's permissions.
- **Credential risks:** client secret + (for password grant) service-user credentials are bearer-equivalent secrets → **server-side only, never in browser code**, never in `NEXT_PUBLIC_*` vars, never logged.

## 4. APIs

### 4.1 Standard REST API — base `https://{host}/apis/{site}/api`

Authoritative reference: `Documentation/api/STANDARD_API.md` + in-repo `swagger/`.

| Resource | Permissions (cruds) | Backing table | Relevance to us |
|---|---|---|---|
| Patients (`/api/patient`, `/api/patient/{puuid}`) | CRUS | `patient_data` | Registration, directory, profile |
| **Appointments** (`/api/appointment`, `/api/patient/{puuid}/appointment`) | **CRUS** | `pc_event` | **Booking writes — core of our platform** |
| Practitioners (`/api/practitioner`) | RUS | `users` | Doctor directory/profiles |
| Facilities (`/api/facility`) | CRUS | `facility` | Clinic locations |
| Encounters (`/api/patient/{puuid}/encounter`) | CRS | `form_encounter` | Visit history, doctor workspace |
| Insurance companies / patient insurance | CRUS | `insurance_*` | Future insurance flow |
| Documents (`/api/patient/{puuid}/document`) | CRS | `documents` | Uploads/attachments |
| Prescriptions | RS (read-only) | `prescriptions` | Read prescriptions; creation stays in OpenEMR UI or future module |
| Patient messages | CUD | `patient_messages` | Notifications (optional) |
| Transactions/referrals | CRUDS | `lbt_data` | Referrals (future) |

### 4.2 FHIR API — base `https://{host}/apis/{site}/fhir`

- **FHIR R4 (4.0.1)**, US Core 8.0, **SMART on FHIR v2.2.0** certified (ONC).
- 30+ resources: Patient, Practitioner, PractitionerRole, Organization, Location, Encounter,
  Appointment, Condition, AllergyIntolerance, Immunization, Procedure, Medication,
  MedicationRequest, MedicationDispense, Observation (vitals + labs), DiagnosticReport,
  DocumentReference, CarePlan, CareTeam, Coverage, Goal, Device, ServiceRequest, Specimen,
  RelatedPerson…
- Strongest for **reading clinical data** with standardized shapes. Write coverage is thinner and
  scope-gated; scheduling writes are better served by the REST API.

### 4.3 Gaps that shape our architecture

1. **No availability / open-slot endpoint** in REST or FHIR. Provider availability lives in
   `pc_event` rows with schedule categories (e.g. "In Office"/"Out of Office"). **Free-slot
   computation must be done in our adapter**: fetch provider events for a date range, subtract
   booked appointments from availability windows, apply slot duration rules. (A future custom
   module could expose a `/slots` endpoint server-side, but is not required for the demo.)
2. **No mobile-number OTP auth.** Built-in portal auth is username/password. Patient identity
   (mobile + OTP) lives in **our** layer, mapped to the OpenEMR patient UUID.
3. **No wallet/credit concept** that fits cleanly in OpenEMR billing (`billing`/`ar_activity` are
   claim/ledger oriented). Credit module lives in our adapter DB (see ADR-0001 §Wallet).
4. **Payments:** OpenEMR bundles Stripe/Omnipay/Authorize.net libs for its own front payments, but
   a modern checkout is cleaner in our layer; we can post payment records back to OpenEMR billing
   as a later sync step.

## 5. Medical Data Model (table map)

| Domain | Table(s) | API access |
|---|---|---|
| Patients / demographics | `patient_data` | REST `patient`, FHIR `Patient` |
| Appointments + provider availability | `pc_event` (+ `openemr_postcalendar_categories`) | REST `appointment` (CRUS), FHIR `Appointment` (read) |
| Encounters / visits | `form_encounter`, `forms` | REST `encounter`, FHIR `Encounter` |
| Problems / diagnoses | `lists` (type `medical_problem`) | FHIR `Condition` |
| Allergies | `lists` (type `allergy`) | FHIR `AllergyIntolerance` |
| Medications | `lists` (type `medication`) | FHIR `Medication`/`MedicationRequest` |
| Prescriptions | `prescriptions` | REST (read), FHIR `MedicationRequest` |
| Vitals | `form_vitals` | FHIR `Observation` (vital-signs) |
| Lab results | `procedure_order`, `procedure_result` | FHIR `Observation` (laboratory), `DiagnosticReport` |
| Documents / imaging reports | `documents`, `categories` | REST `document`, FHIR `DocumentReference` |
| Clinical notes | `forms` + SOAP/clinical note forms | FHIR `DocumentReference`/encounter forms |
| Billing / fees | `billing`, `ar_session`, `ar_activity`, `payments` | Limited API; mostly internal |
| Insurance | `insurance_data`, `insurance_companies` | REST insurance endpoints, FHIR `Coverage` |
| Users / providers | `users` (+ gacl ACL tables) | REST `practitioner`, FHIR `Practitioner` |
| Services / fee sheet | `codes`, `fee_sheet_options` | Reference lists; our Services catalog can mirror or mock |

## 6. Customization Options

| Mechanism | Verdict |
|---|---|
| **REST/FHIR APIs** | ✅ Primary integration surface (our choice) |
| **Custom modules** (`interface/modules/custom_modules/`, Laminas-based, event subscribers, own routes/menus) | ✅ Sanctioned, upgrade-safe. Reserve for future needs (slot endpoint, wallet-in-EMR) |
| Event dispatcher (`src/Events/…`, Symfony EventDispatcher) | ✅ Used *inside* custom modules to hook appointments, encounters, menus |
| Theming (`interface/themes/`) | ⚠️ Only restyles legacy UI — irrelevant; we build our own frontend |
| Direct DB reads | ⚠️ Only as last resort, read-only, documented — schema changes between versions |
| Direct DB writes / core file edits | ❌ Forbidden — breaks upgrades, bypasses business logic + audit |

## 7. Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | No slot endpoint → naive slot logic could double-book | High | Adapter computes slots then **re-validates on create** (fetch conflicts just before POST); demo uses low concurrency; future custom module for atomic hold |
| R2 | Password grant in production | High | Demo-only; ADR mandates client_credentials + JWKS before staging/prod |
| R3 | OpenEMR version upgrades change API behavior | Medium | Pin tested OpenEMR version in env docs; adapter isolates all OpenEMR calls in one client module; contract tests in Phase 2 |
| R4 | PHI exposure through our layer | High | Role-scoped BFF endpoints, no PHI in logs, no PHI in mock data (fully synthetic), audit trail on writes |
| R5 | XAMPP/local install friction stalls Phase 2 | Medium | Docker compose primary path; mock mode keeps Phase 1 unblocked entirely |
| R6 | FHIR/REST auth scope misconfiguration | Medium | Register minimal scopes; document exact scope string in `.env.example` comments |
| R7 | Wallet drift vs OpenEMR billing | Medium | Wallet is ledger-based (immutable transactions, derived balance); reconciliation/sync designed but deferred |
