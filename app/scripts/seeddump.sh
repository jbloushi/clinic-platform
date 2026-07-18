#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# seeddump.sh — snapshot the demo dataset for repeatable resets.
#
# Dumps BOTH stores the demo depends on:
#   1. the platform DB (clinic_platform) — identities, bookings, services, etc.
#   2. the OpenEMR demo data the seed writes (patients, users, appointments,
#      clinical records) — a WHOLE-DB dump of the OpenEMR schema.
#
# Run this on the VPS AFTER `npm run setup` has produced a good demo state.
# Restore later with seedrestore.sh to wipe visitor-generated junk and return
# the showcase to a known-good baseline.
#
# Env (or edit the defaults):
#   PLATFORM_DB, OPENEMR_DB, DB_HOST, DB_PORT, DB_USER, DB_PASS, OUT_DIR
#
# Usage:  DB_USER=root DB_PASS=secret ./scripts/seeddump.sh
# ---------------------------------------------------------------------------
set -euo pipefail

PLATFORM_DB="${PLATFORM_DB:-clinic_platform}"
OPENEMR_DB="${OPENEMR_DB:-openemr}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
OUT_DIR="${OUT_DIR:-./demo-snapshots}"

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT_DIR"

auth=(-h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER")
[ -n "$DB_PASS" ] && auth+=("-p$DB_PASS")

echo "· dumping platform DB ($PLATFORM_DB)…"
mysqldump "${auth[@]}" --single-transaction --routines "$PLATFORM_DB" \
  > "$OUT_DIR/platform-$STAMP.sql"

echo "· dumping OpenEMR DB ($OPENEMR_DB)…"
mysqldump "${auth[@]}" --single-transaction --routines "$OPENEMR_DB" \
  > "$OUT_DIR/openemr-$STAMP.sql"

# Stable 'latest' pointers so restore doesn't need the timestamp.
cp -f "$OUT_DIR/platform-$STAMP.sql" "$OUT_DIR/platform-latest.sql"
cp -f "$OUT_DIR/openemr-$STAMP.sql"  "$OUT_DIR/openemr-latest.sql"

echo "✓ snapshot written to $OUT_DIR (platform-$STAMP.sql, openemr-$STAMP.sql; latest updated)"
echo "  NOTE: these dumps contain demo data + hashes — keep them out of git (demo-snapshots/ is gitignored)."
