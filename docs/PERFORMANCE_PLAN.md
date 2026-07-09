# Performance & Concurrency Plan

Goal: cut perceived loading time and make concurrent login/use reliable, executed
mostly on **cheaper models**. Each task is tagged with the model to run it on and
a hard acceptance check. Work top-to-bottom; do not skip Phase 0.

## TL;DR root causes (measured against this repo)

1. **App runs in `next dev`** — compiles routes on demand, unminified. Biggest single cost.
2. **23 pages `export const dynamic = 'force-dynamic'`** with no caching → every hit re-fetches OpenEMR.
3. **N+1 fan-out**: `/doctors` = `getPractitioners()` + one `getAvailableSlots()` **per doctor**; each
   `getAvailableSlots` fetches the whole appointments table (OpenEMR ignores `date_start/date_end`).
   Landing does the same for 3 doctors.
4. **Concurrency**: OAuth token + practitioner/patient identity maps are already process-cached (good).
   The real risk under load is **SQLite single-writer locks** (OTP / bookings / wallet writes).

---

## Model-switch protocol

When a phase says "SWITCH", tell the user in chat: *"Switch to <model> now (/model <id>)"* and
**pause** until they confirm. Rationale: mechanical/config/verification work runs fine on Haiku;
data-layer refactors need Sonnet; only the one architecture decision needs Opus.

| Phase | Work | Model | /model id |
|---|---|---|---|
| 0 | Run in production mode | **Haiku 4.5** | `claude-haiku-4-5-20251001` |
| 1 | Cache OpenEMR reads + ISR | **Sonnet 5** | `claude-sonnet-5` |
| 2 | Kill the N+1 slot fan-out | **Sonnet 5** | `claude-sonnet-5` |
| 3a | SQLite WAL (quick concurrency win) | **Sonnet 5** | `claude-sonnet-5` |
| 3b | DECISION: stay SQLite vs move to Postgres | **Opus 4.8** (+ user) | `claude-opus-4-8` |
| 4 | Measure loading + concurrent-login test | **Haiku 4.5** | `claude-haiku-4-5-20251001` |

Start of every phase: the executing agent restates "Running Phase N on <model>". If the current
model doesn't match the table, STOP and ask the user to switch first.

---

## Phase 0 — Run in production mode  ▶ SWITCH TO HAIKU 4.5 — ✅ DONE

Highest impact, lowest risk. `next dev` is the main perceived-slowness source.

- **0.1** ✅ Added `"prod": "next build && next start -p 3000"` to `app/package.json` (kept `dev` for editing).
- **0.2** Not done — `.claude/launch.json` still points `clinic-web` at `npm run dev` (used by the
  Preview MCP for live editing, which needs dev's fast refresh). Launch prod manually with
  `npm run prod` (or `npm run build` then `npm run start`) when testing real load times.
- **0.3** **HARD RULE, not just an ordering tip**: running `next dev` **at any point** — even briefly,
  even after a successful build — overwrites/clobbers the `.next` prod build artifacts. Confirmed
  this session: built clean, ran `next dev` to capture a comparison baseline, killed it, and
  `next start` then failed with "Could not find a production build in the '.next' directory." Do
  **not** run `next dev` in the same `.next` output between a build and a `next start` you intend to
  keep serving. If you need a dev-mode comparison, do it, then **rebuild** (`npm run build`) before
  going back to `next start`. Always `taskkill //F //IM node.exe` before switching modes — orphaned
  Node processes hold port 3000 and MariaDB connections.

**Acceptance:** ✅ `npm run build` compiles all 47 routes clean. `next start` verified serving `/` and
`/doctors` at 200.

**Measured baseline (this box, OpenEMR + MariaDB warm, single request each):**

| Page | Dev cold | Dev "warm"¹ | Prod cold | Prod warm |
|---|---|---|---|---|
| `/` (landing) | 1.90s | 4.06s | 1.20s | 1.07s |
| `/doctors` | 7.73s | 2.80s | 1.46s | 1.16s |
| `/staff/login` (static) | 1.89s | 0.14s | 0.04s | **0.006s** |

¹ Dev "warm" numbers are noisy (background file-watch recompilation), not representative — ignore
the `/` warm outlier.

**Reading this:** prod mode alone gives `/staff/login` a **~300x** speedup (static page, no more
per-request compile) and `/doctors` **~2.4x** warm. But `/` and `/doctors` still sit around **~1.1s
warm in prod** — that floor is OpenEMR round-trip time, not dev/prod overhead. That's exactly what
Phases 1–2 (caching + killing the N+1 slot fan-out) exist to cut. Do not expect Phase 0 alone to fix
the `/doctors` load — it fixes the "everything is slow because it's dev mode" tax; the remaining
~1s is real backend I/O addressed next.

---

## Phase 1 — Cache OpenEMR reads + ISR  ▶ SWITCH TO SONNET 5

Reference data (practitioners, services, availability) barely changes between requests. Stop
re-fetching it on every page hit.

- **1.1** Add a tiny shared TTL cache helper (or reuse the identity-map pattern already in
  `lib/data/openemr/provider.ts`). Wrap read-only provider methods that back list/landing pages:
  `getPractitioners` (TTL 120s), `getAvailableSlots` per (doctorId, from, to) (TTL 60s),
  `listServices` (TTL 300s). Keep writes uncached and **invalidate on write** (e.g. after
  `createPractitioner`/availability update, clear the practitioners cache).
  - Prefer Next's `unstable_cache` with tags, or a module-level `Map<string,{at,val}>` like the
    existing `pracMapCache`. Do NOT cache anything patient-identifying across users.
- **1.2** Replace `force-dynamic` with `export const revalidate = 60` on the **public, non-personalized**
  pages only: `/` (landing) and `/doctors`. Leave `force-dynamic` on authed pages (ops/doctor/account)
  — they read session and per-user data.
- **1.3** Landing (`app/src/app/page.tsx`): the featured-doctor `getAvailableSlots` loop now hits the
  Phase-1 cache; confirm it does (no extra round-trips on a warm second load).

**Acceptance:** second load of `/doctors` within the TTL issues **0** OpenEMR calls for the doctor
list (add a temporary `console.time`/log in the provider to prove cache hits, then remove it).
`tsc --noEmit` clean.

---

## Phase 2 — Kill the N+1 slot fan-out  ▶ SWITCH TO SONNET 5

`/doctors` and landing compute availability by calling `getAvailableSlots` once per doctor, and each
call re-fetches the appointments table. Fetch appointments **once** for the window, then compute all
doctors' slots from that single dataset.

- **2.1** Add a provider method `getAvailableSlotsBulk(practitionerIds, from, to)` (or an internal
  batch): fetch appointments for the window **once**, group by practitioner numeric id, then run the
  existing `computeAvailableSlots` per doctor against the in-memory group (no per-doctor REST call).
  Reuse `getPractitionerMaps()` for the uuid↔numeric crosswalk and `getPractitionerAvailability`
  (Prisma) — batch the Prisma reads too (`findMany` once, not per doctor).
- **2.2** Point `app/src/app/doctors/page.tsx` and the landing featured loop at the bulk method.
- **2.3** (Correctness note found while planning — fix if cheap) `slots.ts` trusts OpenEMR to filter
  `/appointment` by `pc_aid`, but OpenEMR ignores server-side filters (see the client-side filtering
  already added in `provider.getAppointments`). Ensure the bulk grouping filters by practitioner
  **in app code**, or a doctor's availability will be reduced by *other* doctors' appointments.

**Acceptance:** `/doctors` cold load issues **1** appointments fetch total (not one per doctor);
slot counts on cards remain correct vs. before. `tsc` clean.

---

## Phase 3 — Concurrency hardening

### 3a — SQLite WAL + busy timeout  ▶ SWITCH TO SONNET 5 (quick win)

Default SQLite serializes writers and errors on lock contention — bad for simultaneous OTP verifies /
bookings. WAL lets readers not block writers and adds a busy-wait.

- **3a.1** On Prisma/SQLite startup, run once: `PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;`
  (execute via `prisma.$executeRawUnsafe` in `lib/db.ts` after client init, guarded to run once).
- **3a.2** Keep write transactions short; ensure OTP verify + booking create use a single
  `prisma.$transaction` where multiple rows change.

**Acceptance:** a concurrent-login test (Phase 4) shows no `SQLITE_BUSY`/locked errors.

### 3b — DECISION: SQLite vs Postgres  ▶ SWITCH TO OPUS 4.8 (with the user)

WAL is enough for a demo and light concurrency. Real multi-user production wants Postgres (already the
Phase-3 target in ADR-0001). **Pause here and ask the user** which they want:
- Stay SQLite+WAL (zero infra, fine for demo / a few concurrent users), or
- Move the platform DB to Postgres (compose service + `DATABASE_URL` swap + `prisma migrate`).

Do not implement 3b without the user's choice. If Postgres: that's its own task list (provision,
migrate schema, repoint `ADAPTER_DATABASE_URL`, retest booking/OTP/wallet).

---

## Phase 4 — Measure & verify  ▶ SWITCH TO HAIKU 4.5

- **4.1** Loading: with `npm run prod` running, time cold + warm loads of `/`, `/doctors`,
  `/doctors/[id]` (curl `-w "%{time_total}"`). Record before/after in this file.
- **4.2** Concurrency: small script firing N parallel `POST /api/auth/patient/request-otp` +
  `verify-otp` (and a couple of parallel `/api/bookings`) against seeded mobiles; assert all succeed,
  no 500s, no SQLITE_BUSY. Fix fallout on Sonnet if any.
- **4.3** Remove any temporary timing logs added in Phase 1.

**Acceptance:** warm `/doctors` load time meaningfully lower than the Phase-0 baseline; concurrency
script passes clean.

---

## Guardrails (all phases)

- OpenEMR (Apache + MariaDB :3307) drops intermittently on this box — if pages show
  "Something went wrong / fetch failed", restart XAMPP Apache + MariaDB, then restart the Next server
  (it caches a dead connection on cold start).
- Never cache per-user / patient-identifying data in a process-wide cache.
- Run `npx tsc --noEmit` after each phase. Do not run `next build` while `next dev` is live.
- Commit after each phase with a clear message; keep phases independently revertable.
