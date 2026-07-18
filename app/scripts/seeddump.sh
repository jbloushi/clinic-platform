#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# seeddump.sh — snapshot the demo dataset for repeatable resets.
#
# Dumps BOTH stores the demo depends on:
#   1. the platform DB (clinic_platform) — identities, bookings, services, etc.
#   2. the OpenEMR DB — patients, users, appointments, clinical records.
#
# Each DB is dumped with its OWN user, so you don't need a MySQL super-user
# (on a shared/managed box like aaPanel you often can't use root). --no-tablespaces
# avoids the PROCESS privilege that MySQL 8 otherwise requires.
#
# Run on the VPS AFTER `npm run setup` produced a good demo state. Restore
# later with seedrestore.sh.
#
# Env:
#   PLATFORM_DB / OPENEMR_DB      database names
#   DB_HOST / DB_PORT            server (default 127.0.0.1 / 3306)
#   PLATFORM_USER / PLATFORM_PASS  creds for the platform DB
#   OPENEMR_USER  / OPENEMR_PASS   creds for the OpenEMR DB
#   DB_USER / DB_PASS            shared fallback if the per-DB ones are unset
#   OUT_DIR                      output dir (default ./demo-snapshots)
#
# Usage (per-DB users, no root needed):
#   PLATFORM_USER=clinic_platform PLATFORM_PASS='...' \
#   OPENEMR_USER=openemr OPENEMR_PASS='...' DB_PORT=3307 ./scripts/seeddump.sh
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

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT_DIR"

dump() { # <user> <pass> <db> <outfile>
  local u="$1" p="$2" db="$3" out="$4"
  local args=(-h "$DB_HOST" -P "$DB_PORT" -u "$u" --single-transaction --no-tablespaces --routines)
  [ -n "$p" ] && args+=("-p$p")
  mysqldump "${args[@]}" "$db" > "$out"
}

echo "· dumping platform DB ($PLATFORM_DB) as $PLATFORM_USER…"
dump "$PLATFORM_USER" "$PLATFORM_PASS" "$PLATFORM_DB" "$OUT_DIR/platform-$STAMP.sql"

echo "· dumping OpenEMR DB ($OPENEMR_DB) as $OPENEMR_USER…"
dump "$OPENEMR_USER" "$OPENEMR_PASS" "$OPENEMR_DB" "$OUT_DIR/openemr-$STAMP.sql"

# Stable 'latest' pointers so restore doesn't need the timestamp.
cp -f "$OUT_DIR/platform-$STAMP.sql" "$OUT_DIR/platform-latest.sql"
cp -f "$OUT_DIR/openemr-$STAMP.sql"  "$OUT_DIR/openemr-latest.sql"

echo "✓ snapshot written to $OUT_DIR (platform-$STAMP.sql, openemr-$STAMP.sql; latest updated)"
echo "  NOTE: these dumps contain demo data + hashes — keep them out of git (demo-snapshots/ is gitignored)."
