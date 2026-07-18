# Deployment runbook — full demo on the aaPanel VPS

Goal: a public, self-contained demo. The Next.js app runs on its own subdomain
(**`book.mawthook.io`**, placeholder — rename freely) and talks to the OpenEMR
already living at **`https://clinic.mawthook.io`**. A visitor can register with
a mobile number + OTP `123456`, log in, and book an appointment + service; staff
see it in the ops calendar. The dataset is seeded once and snapshot for resets.

This runbook is **executed by a human on the VPS** — the assistant that wrote it
has no VPS access. Work top to bottom; each section is a checklist.

> Scope note: this is a **demo**. `OTP_MODE=mock` means anyone can verify any
> number with `123456`. Never point this at real patient data, and never reuse
> the demo `AUTH_SESSION_SECRET`.

---

## 0. Prerequisites on the VPS

- aaPanel with **Nginx**, **MySQL/MariaDB**, and **Node.js ≥ 20** (via aaPanel's
  Node project manager, which uses PM2).
- OpenEMR reachable at `https://clinic.mawthook.io`, with its MariaDB local to
  the box (so the app + seed can reach it on `127.0.0.1:3306`).
- DNS: an **A record for `book.mawthook.io`** → the VPS IP.
- Git access to this repo.

---

## 1. Prepare the OpenEMR side (one-time)

Do this on `clinic.mawthook.io`'s OpenEMR before seeding.

1. **Enable the APIs** — Administration → Globals → Connectors:
   - `Enable OpenEMR Standard REST API` = on
   - `Enable OpenEMR Standard FHIR API` = on
   - `Enable OAuth2 Password Grant` = on (demo only)
   - Set `site_addr_oath` = `https://clinic.mawthook.io` (used to build OAuth URLs)
2. **Register an OAuth2 client** (dynamic registration), then **enable it**
   (new clients are disabled by default): Administration → System → **API Clients**.
   - Redirect URI: `https://book.mawthook.io/api/auth/openemr/callback`
   - Record `client_id` + `client_secret`.
3. **Create a least-privileged API service user** (or reuse `clinic-admin`) for
   the password grant; record its username/password.
4. **Find the facility + calendar-category IDs the seed needs.** A fresh install
   may differ from the local defaults (facility 3, category 5). Run against the
   OpenEMR DB:
   ```sql
   SELECT id, name FROM facility;                         -- pick your clinic facility id
   SELECT pc_catid, pc_catname FROM openemr_postcalendar_categories
     WHERE pc_catname LIKE '%Office%';                    -- office-visit category id
   ```
   Note these for `SEED_FACILITY_ID` / `SEED_OFFICE_VISIT_CATID` below.

---

## 2. Platform database

Create the dedicated schema on the same MariaDB (do NOT reuse the OpenEMR DB):

```sql
CREATE DATABASE clinic_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'clinic'@'127.0.0.1' IDENTIFIED BY '<strong-pass>';
GRANT ALL PRIVILEGES ON clinic_platform.* TO 'clinic'@'127.0.0.1';
FLUSH PRIVILEGES;
```

---

## 3. App code + environment

```bash
git clone <repo> /www/wwwroot/clinic-app && cd /www/wwwroot/clinic-app/app
npm ci
```

Create **`app/.env.local`** (runtime) from `.env.example`, and a matching
**`app/.env`** (Prisma CLI + seed). Both are gitignored. Fill from the VPS
override block at the bottom of `.env.example`. Minimum:

```
NEXT_PUBLIC_APP_ENV=production
APP_ENV=production
USE_MOCK_DATA=false
ALLOW_WRITES=true
OTP_MODE=mock
AUTH_SESSION_SECRET=<32+ fresh random chars>       # e.g. openssl rand -hex 24
ADAPTER_DATABASE_URL=mysql://clinic:<pass>@127.0.0.1:3306/clinic_platform
OPENEMR_DB_URL=mysql://<openemr_user>:<pass>@127.0.0.1:3306/<openemr_db>
OPENEMR_BASE_URL=https://clinic.mawthook.io
OPENEMR_API_URL=https://clinic.mawthook.io/apis/default/api
OPENEMR_FHIR_URL=https://clinic.mawthook.io/apis/default/fhir
OPENEMR_OAUTH_TOKEN_URL=https://clinic.mawthook.io/oauth2/default/token
OPENEMR_GRANT_TYPE=password
OPENEMR_CLIENT_ID=<from step 1.2>
OPENEMR_CLIENT_SECRET=<from step 1.2>
OPENEMR_API_USERNAME=<service user>
OPENEMR_API_PASSWORD=<service user pass>
SEED_FACILITY_ID=<from step 1.4>
SEED_OFFICE_VISIT_CATID=<from step 1.4>
```

`app/.env` needs at least `ADAPTER_DATABASE_URL`, `OPENEMR_DB_URL`,
`SEED_FACILITY_ID`, `SEED_OFFICE_VISIT_CATID` (the seed reads this file).

---

## 4. Migrate + seed + build

```bash
cd /www/wwwroot/clinic-app/app
npm run prisma:push          # create tables in clinic_platform
npm run setup                # prisma/seed.ts (staff+services) + seed-openemr.ts (OpenEMR demo data)
npm run build                # production build
```

`npm run setup` is **clear-and-reseed** — it wipes prior demo data in OpenEMR.
That's expected for a demo instance; never run it against real data.

Sanity check before exposing it:
```bash
node -e "require('http')" # node present
# staff login works, /doctors lists specialists, a visitor can book — see §7.
```

---

## 5. Run under PM2 (via aaPanel Node project)

Point aaPanel's Node project at `/www/wwwroot/clinic-app/app`, or manually:

```bash
cd /www/wwwroot/clinic-app/app
pm2 start "npm run start" --name clinic-web      # next start -p 3000
pm2 save
```

The app listens on `:3000` (see `package.json` `start`). Keep it bound to
localhost; Nginx terminates TLS and proxies to it.

---

## 6. Nginx + TLS for book.mawthook.io

Create an aaPanel site for `book.mawthook.io`, issue a Let's Encrypt cert, and
set the reverse proxy to `http://127.0.0.1:3000`. Equivalent server block:

```nginx
server {
    server_name book.mawthook.io;
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
    }
    listen 443 ssl;   # aaPanel fills in ssl_certificate lines
}
server { listen 80; server_name book.mawthook.io; return 301 https://$host$request_uri; }
```

---

## 7. Smoke test the demo

1. `https://book.mawthook.io/` loads; **Find a specialist** lists 8 specialists.
2. **Book by service** shows services (not the doctor-only `Procedure (in-clinic)`).
3. Visitor flow: enter a new mobile → OTP `123456` → pick a slot → confirm.
4. Staff: log in at `/staff/login` (`admin@clinic.local` / `demo1234`), open
   **Calendar** on the booked day → the visitor's appointment is there.
5. Ops → **Services**: the `Search` column shows `Procedure (in-clinic)` as
   `Doctor-only`; toggling persists.

---

## 8. Snapshot + reset

Once §7 passes, snapshot the good state so you can reset after visitors poke at it:

```bash
cd /www/wwwroot/clinic-app/app
DB_USER=root DB_PASS=<pass> OPENEMR_DB=<openemr_db> ./scripts/seeddump.sh
```

To reset later (drops + reloads both DBs from the snapshot):
```bash
DB_USER=root DB_PASS=<pass> OPENEMR_DB=<openemr_db> ./scripts/seedrestore.sh
pm2 restart clinic-web
```

Snapshots land in `app/demo-snapshots/` (gitignored — they contain data + hashes).
Optionally schedule a nightly `seedrestore.sh` via cron to keep the showcase clean.

---

## 9. Production hardening (beyond the demo)

Deferred, but note for later: switch OpenEMR OAuth to `client_credentials + JWKS`
(ADR-0001 / DECISION_LOG D4), replace mock OTP with real WhatsApp delivery
(the Chatwoot plumbing in `lib/chatwoot.ts` — needs the `CHATWOOT_*` vars and a
Meta-approved Authentication template), and move off the shared demo secret.
