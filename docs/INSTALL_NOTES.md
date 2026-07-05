# Local OpenEMR — Install Notes (verified working)

Records the state of the local, non-Docker OpenEMR deployment set up on 2026-07-05.
This is the **Phase 2 integration target**; Phase 1 does not require it running.

## Stack

| Component | Version | Location |
|---|---|---|
| OS | Windows 11 (this workstation) | — |
| Web server | Apache 2.4.58 (Win64) via XAMPP | `C:\xampp\apache\` |
| PHP | 8.2.12 (ZTS, VS16 x64) | `C:\xampp\php\`, ini `C:\xampp\php\php.ini` |
| DB | MariaDB 10.4.32 via XAMPP | `C:\xampp\mysql\`, data `C:\xampp\mysql\data\` |
| OpenEMR | 8.0.0.3 (schema v531, ACL v12) | `C:\xampp\htdocs\openemr\` |

**Port map:** Apache 80 + 443, XAMPP MariaDB **3307** (the machine also runs a MySQL 8 Windows
service on 3306 that OpenEMR does not touch), OpenEMR OAuth uses `http://localhost/...` (permitted
without TLS because it is `localhost`).

## Config changes made during setup

1. **php.ini** (`C:\xampp\php\php.ini`, original backed up to `php.ini.openemr-backup`)
   - Enabled extensions required by OpenEMR: `gd`, `ldap`, `soap`, `sockets`, `sodium`, `xsl`, `zip`
     (curl, intl, mbstring, mysqli, openssl, etc. were already on).
   - Tuned limits: `memory_limit=512M`, `max_execution_time=300`, `max_input_time=300`,
     `max_input_vars=10000`, `post_max_size=100M`, `upload_max_filesize=100M`.
2. **MariaDB (`C:\xampp\mysql\bin\my.ini`)** — no changes; already on port 3307. `openemr` DB and
   dedicated `openemr` MySQL user were created by the OpenEMR setup wizard.
3. **OpenEMR globals** — enabled Standard REST API + FHIR API + OAuth2 **password grant** (demo
   only; production must switch to `client_credentials + JWKS` per ADR-0001):
   ```sql
   -- table: globals
   rest_api            = 1
   rest_fhir_api       = 1
   oauth_password_grant = 1
   site_addr_oath      = http://localhost/openemr
   ```
4. **Admin password** reset to a known demo value via bcrypt hash:
   - Username: `clinic-admin`
   - Password: `Demo!Pass123`
   - Login URL: <http://localhost/openemr/interface/login/login.php?site=default>

> A one-shot helper `C:\xampp\htdocs\openemr\_reset_admin.php` was created during setup and can be
> deleted (`del C:\xampp\htdocs\openemr\_reset_admin.php`). Auto-cleanup was blocked by the sandbox.

## URLs

| Purpose | URL |
|---|---|
| Login (Ops UI) | http://localhost/openemr/interface/login/login.php?site=default |
| REST base | http://localhost/openemr/apis/default/api |
| FHIR base (R4) | http://localhost/openemr/apis/default/fhir |
| FHIR capability statement | http://localhost/openemr/apis/default/fhir/metadata |
| OAuth2 token | http://localhost/openemr/oauth2/default/token |
| OAuth2 dynamic client registration | http://localhost/openemr/oauth2/default/registration |
| phpMyAdmin | http://localhost/phpmyadmin/ |

## OAuth2 client (registered for the Phase 2 adapter)

- `client_id` and `client_secret` are stored in `.secrets/oauth-client.local.json` (gitignored).
- Client was registered via `POST /oauth2/default/registration`, then **enabled** by admin via:
  ```sql
  UPDATE oauth_clients SET is_enabled = 1 WHERE client_id = '<the id>';
  ```
  **Newly registered OAuth clients in OpenEMR 8.0 are disabled by default** — the admin UI path is
  Administration → System → **API Clients** (checkbox → Save).
- Redirect URI: `http://localhost:3000/api/auth/openemr/callback` (matches the Phase 1 Next.js dev port).

### Working scopes (verified)

- FHIR reads: `openid user/Patient.rs user/Practitioner.rs user/Appointment.rs`
  (extend with `user/Encounter.rs user/Condition.rs user/AllergyIntolerance.rs
  user/MedicationRequest.rs user/Observation.rs user/DocumentReference.rs user/Coverage.rs`
  as the adapter needs them).
- Standard REST for scheduling writes: **lowercase resource + `.cruds`**, e.g.
  `user/appointment.cruds user/patient.cruds`. FHIR-style `.cru` combinations are rejected on
  some resources.

### Verified token exchange (password grant, for demo only)

```
POST /oauth2/default/token
Content-Type: application/x-www-form-urlencoded

grant_type=password
client_id=<id>
client_secret=<secret>
user_role=users
scope=openid user/Patient.rs user/Practitioner.rs user/Appointment.rs
username=clinic-admin
password=Demo!Pass123
```

Returns `access_token` (Bearer, `expires_in ≈ 3600`) and `refresh_token`. Confirmed working against
this install; a Patient search then returns a well-formed FHIR `Bundle` (total = 0 on empty install).

## Data state

Fresh install — 0 patients, 0 appointments, 0 encounters, 0 clinical notes. Seeding synthetic
clinical data is **not** part of Phase 2; the adapter itself supplies demo data via `MockProvider`,
and Phase 2 integration testing can be done against a manually created patient/appointment through
the OpenEMR UI.

## How to start / stop the stack

Both services are Windows-visible processes today. Start/stop via:

- **XAMPP Control Panel** (`C:\xampp\xampp-control.exe`) — recommended.
- Or command line:
  ```powershell
  # Start
  Start-Process C:\xampp\apache\bin\httpd.exe
  Start-Process C:\xampp\mysql\bin\mysqld.exe -ArgumentList '--defaults-file=C:\xampp\mysql\bin\my.ini','--standalone'
  # Stop
  Stop-Process -Name httpd -Force
  C:\xampp\mysql\bin\mysqladmin.exe -uroot -h 127.0.0.1 -P 3307 shutdown
  ```

## Troubleshooting quick reference

| Symptom | Fix |
|---|---|
| `caching_sha2_password could not be loaded` when running `mysql.exe` | You hit the system MySQL 8 on port 3306. Use `-h 127.0.0.1 -P 3307` to hit XAMPP MariaDB |
| PHP CLI: `Unable to load dynamic library …` | `php.ini` uses relative paths; run PHP from `C:\xampp` (`Push-Location C:\xampp; .\php\php.exe …`) — Apache-served PHP is unaffected |
| Token exchange returns `invalid_client` | The client is registered but not yet enabled by admin — see the SQL above or Admin UI |
| Token exchange returns `invalid_scope` | Some cruds combinations are rejected on FHIR resources; use `.rs` for reads and lowercase Standard-API scopes for writes |
| Login page shows `error=1` | Wrong password OR IP got locked; clear with `DELETE FROM ip_tracking WHERE ip_string IN ('::1','127.0.0.1');` |
| Setup wizard reappears at `/openemr/` | `sites/default/sqlconf.php` `$config` var is 0 or missing — a fresh install writes `$config = 1;` at the bottom |

## What's NOT done here (deferred to Phase 2)

- Switch OpenEMR OAuth to `client_credentials + JWKS` — needed before staging/production (ADR-0001 §Auth Strategy).
- TLS on Apache (OpenEMR OAuth only tolerates HTTP because we're on `localhost`).
- MariaDB upgrade from 10.4.32 → 10.6+ to match the OpenEMR recommendation. 10.4 works for install
  and API traffic; upgrade before any real clinical usage.
- Enable audit logging + backup schedule.
