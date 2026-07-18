#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# seedrestore.sh — reset the demo to a snapshot made by seeddump.sh.
#
# Reloads BOTH the platform DB and the OpenEMR DB from the 'latest' dumps
# (or a timestamp you pass), wiping any visitor-generated data since the snap.
#
# Each DB is reloaded with its OWN user — no MySQL super-user needed. The
# dumps carry DROP TABLE / CREATE TABLE (mysqldump default), so reloading
# resets the tables in place; we do NOT drop the databases (that would need
# root). Only run against the dedicated demo instance — never real data.
#
# Env:
#   PLATFORM_DB / OPENEMR_DB       database names
#   DB_HOST / DB_PORT             server (default 127.0.0.1 / 3306)
#   PLATFORM_USER / PLATFORM_PASS   creds for the platform DB
#   OPENEMR_USER  / OPENEMR_PASS    creds for the OpenEMR DB
#   DB_USER / DB_PASS             shared fallback if the per-DB ones are unset
#   OUT_DIR                       snapshot dir (default ./demo-snapshots)
# Arg:  optional snapshot stamp (e.g. 20260718-201500); defaults to 'latest'.
#
# Usage:
#   PLATFORM_USER=clinic_platform PLATFORM_PASS='...' \
#   OPENEMR_USER=openemr OPENEMR_PASS='...' DB_PORT=3307 ./scripts/seedrestore.sh
# ---------------------------------------------------------------------------
set -euo pipefail

PLATFORM_DB="${PLATFORM_DB:-clinic_platform}"
OPENEMR_DB="${OPENEMR_DB:-openemr}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
PLATFORM_USER="${PLATFORM_USER:-${DB_USER:-root}}"
PLATFORM_PASS="${PLATFORM_PASS:-${DB_PASS:-}}"
OPENEMR_USER="${OPENEMR_USER:-${DB_USER:-root}}"
OPENEMR_PASS="${OPENEMR_PASS:-${DB_PASS:-}}"
OUT_DIR="${OUT_DIR:-./demo-snapshots}"
STAMP="${1:-latest}"

platform_sql="$OUT_DIR/platform-$STAMP.sql"
openemr_sql="$OUT_DIR/openemr-$STAMP.sql"
[ -f "$platform_sql" ] || { echo "missing $platform_sql" >&2; exit 1; }
[ -f "$openemr_sql" ]  || { echo "missing $openemr_sql" >&2; exit 1; }

echo "!! Reloads '$PLATFORM_DB' and '$OPENEMR_DB' from snapshot '$STAMP' (drops+recreates their TABLES)."
read -r -p "Type 'yes' to continue: " confirm
[ "$confirm" = "yes" ] || { echo "aborted."; exit 1; }

load() { # <user> <pass> <db> <file>
  local u="$1" p="$2" db="$3" f="$4"
  local args=(-h "$DB_HOST" -P "$DB_PORT" -u "$u")
  [ -n "$p" ] && args+=("-p$p")
  mysql "${args[@]}" "$db" < "$f"
}

echo "· restoring platform DB…"
load "$PLATFORM_USER" "$PLATFORM_PASS" "$PLATFORM_DB" "$platform_sql"
echo "· restoring OpenEMR DB…"
load "$OPENEMR_USER" "$OPENEMR_PASS" "$OPENEMR_DB" "$openemr_sql"

echo "✓ demo restored from snapshot '$STAMP'. Run: pm2 restart clinic-web"
