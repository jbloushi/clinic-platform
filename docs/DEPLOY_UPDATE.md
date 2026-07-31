# Deployment runbook — pulling an update onto the aaPanel VPS

For the **first-ever** setup of `book.mawthook.io`, use [`DEPLOY_VPS.md`](./DEPLOY_VPS.md).
This one is for pulling a **later update** into an already-running install —
same repo, same database, no OpenEMR reconfiguration needed.

This adds the real booking-hold engine (atomic reservation, real
auto-assignment), a mock payment gate, the `/book/v2` dual patient journey,
ops CRUD for offerings/assignment-settings, and a flexible reschedule flow.
None of it is destructive to what's already deployed: the old `/book` flow,
its data, and its API routes are untouched — this is new code living
alongside it, most of it behind a feature flag.

---

## 0. Before you start

- This is **executed on the VPS**, in `/www/wwwroot/clinic-app/app` (or
  wherever `DEPLOY_VPS.md` §3 put it).
- The database was originally provisioned with `npx prisma db push` (schema
  sync, no migration history table) — **keep using `db push` for this update**,
  not `prisma migrate deploy`. A migrations folder now exists in the repo for
  local development's benefit, but running `migrate deploy` against a
  `db push`-provisioned database with no `_prisma_migrations` table will try
  to replay every migration from scratch and fail on tables that already
  exist. If you ever want migration history tracked going forward, baseline
  it first (`prisma migrate resolve --applied <each_migration>`) in a
  separate, deliberate step — not as part of a routine update.
- Nothing here requires taking OpenEMR down. Only the Next.js app restarts.

---

## 1. Pull the update

```bash
cd /www/wwwroot/clinic-app/app
git status                      # confirm no local edits you'd lose — this is a pull, not a reset
git pull origin main
```

## 2. Install dependencies + sync the schema

```bash
npm ci
npx prisma generate
npx prisma db push              # adds the new tables/columns this update needs;
                                 # additive only — nothing existing is dropped or renamed
```

## 3. (Optional) exercise the new engine with real offering data

The new booking-hold engine and `/book/v2` have **nothing to auto-assign
against** until at least one `PractitionerOffering` exists — the old `/book`
flow doesn't need this (it still runs on the old model), but `/book/v2` and
ops → **Offerings** do.

- **Recommended**: configure real offerings by hand in ops → **Offerings**
  once deployed (§6) — pick doctor, service, department, branch per real
  combination your clinic actually offers. This is the only path for
  production data; nothing here should be auto-generated for a real clinic.
- The repo also ships `npm run seed:offerings`, which creates a handful of
  synthetic offerings for exercising the flow — **do not run this against
  real patient/production data**. It's meant for a fresh demo/staging
  database only.

## 4. Add the new environment variables (optional)

Nothing below is required — every one of these defaults to off/on exactly as
the app already behaved, so a plain `git pull` + rebuild changes nothing
patient-visible until you opt in. Add to `app/.env.local` only what you want
to change:

```bash
# Shows the "Try our new booking experience" link and makes /book/v2 reachable.
# Leave unset (false) to keep the old /book flow as the only patient-visible path.
BOOKING_JOURNEY_V2_ENABLED=true

# Only needed if you want the expire-holds cron actually callable — see §7.
CRON_SECRET=<generate: openssl rand -hex 24>
```

`AUTO_ASSIGNMENT_ENABLED` and `PAYMENT_FINALIZATION_ENABLED` default to `true`
already (matching what the new engine assumes); leave them unset unless you
specifically want to turn one off.

## 5. Rebuild and restart

```bash
npm run build
pm2 restart clinic-web
pm2 logs clinic-web --lines 50    # confirm a clean start, no crash loop
```

## 6. Set up the new ops screens (staff, one-time)

1. Log in at `/staff/login` as an `admin` account.
2. Ops → **Offerings** → **New offering**: for each doctor who should be
   auto-assignable and/or patient-selectable for a service at a branch,
   create the row. This is additive to the old model — it does not touch
   the `ServiceSpecialist` table the old `/book` flow still reads.
3. Ops → **Assignment settings**: review the ranking rules (previous-doctor
   preference, workload window, hold duration, slot lock granularity) and
   whether the auto-assigned doctor's name should show before payment. All
   fields have sane defaults from the original migration; only change what
   you mean to.

Until step 2 has at least one offering, `/book/v2` will show "no doctor
currently auto-assigns for this branch" — that's expected, not a bug.

## 7. (Optional) schedule the expire-holds cron

New `BookingHold` rows the v2 engine creates carry a real TTL
(`AssignmentSettings.holdDurationMinutes`, default 15 minutes) instead of
expiring instantly like the old model's rows did. Nothing currently calls
`/api/cron/expire-holds` on a schedule — without it, an abandoned v2 checkout
leaves its slot locked until you add one:

```bash
# crontab -e, run every 5 minutes
*/5 * * * * curl -s -X POST https://book.mawthook.io/api/cron/expire-holds \
  -H "Authorization: Bearer <CRON_SECRET from step 4>" >/dev/null
```

The route refuses to run at all if `CRON_SECRET` is unset on the server side
— so skipping this step is safe (nothing breaks), it just means abandoned
v2 holds only clear once their `PractitionerSlotLock` rows are next touched
by the same doctor/slot being requested again, rather than proactively.

## 8. Smoke test

1. Old flow unaffected: `/book` still lists services and completes a booking
   exactly as before.
2. If you enabled the flag (§4): `/book/v2` → pick a branch → **Find by
   service** → shows the recommended-doctor list (or falls back to the blind
   auto-assign grid if no offering allows patient choice yet) → **Find by
   doctor** → doctors sorted by soonest availability.
3. Complete one `/book/v2` booking end to end with a **card** payment (mock —
   resolves instantly) and confirm it lands on `/book/confirmed`.
4. Ops → **Offerings** shows what you created in §6; **Assignment settings**
   saves and reloads with your values.
5. From `/account/appointments`, open a booking's **Reschedule** → **Want a
   different doctor, service, or branch instead?** and confirm the flexible
   flow loads (branch/service selects, doctor mode toggle, day/time grid).

---

## Rollback

Nothing in this update alters or removes old-model data or routes, so rolling
back is a plain revert-and-redeploy:

```bash
git log --oneline -5            # find the commit before this update
git checkout <previous-sha> -- .
npm ci && npm run build
pm2 restart clinic-web
```

The new tables/columns `db push` added stay in the database (harmless if
unused) — no destructive down-migration is needed to roll back the app code.
