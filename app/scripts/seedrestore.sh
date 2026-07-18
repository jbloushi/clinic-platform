#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# seedrestore.sh — reset the demo to a snapshot made by seeddump.sh.
#
# Restores BOTH the platform DB and the OpenEMR DB from the 'latest' dumps
# (or a timestamp you pass), wiping any visitor-generated data since the snap.
#
# DESTRUCTIVE: it drops and recreates both databases. Only run against the
# dedicated demo instance — never a database with real data.
#
# Env:  PLATFORM_DB, OPENEMR_DB, DB_HOST, DB_PORT, DB_USER, DB_PASS, OUT_DIR
# Arg:  optional snapshot stamp (e.g. 20260718-201500); defaults to 'latest'.
#
# Usage:  DB_USER=root DB_PASS=secret ./scripts/seedrestore.sh
#         DB_USER=root DB_PASS=secret ./scripts/seedrestore.sh 20260718-201500
# ---------------------------------------------------------------------------
set -euo pipefail

PLATFORM_DB="${PLATFORM_DB:-clinic_platform}"
OPENEMR_DB="${OPENEMR_DB:-openemr}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
OUT_DIR="${OUT_DIR:-./demo-snapshots}"
STAMP="${1:-latest}"

platform_sql="$OUT_DIR/platform-$STAMP.sql"
openemr_sql="$OUT_DIR/openemr-$STAMP.sql"
[ -f "$platform_sql" ] || { echo "missing $platform_sql" >&2; exit 1; }
[ -f "$openemr_sql" ]  || { echo "missing $openemr_sql" >&2; exit 1; }

auth=(-h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER")
[ -n "$DB_PASS" ] && auth+=("-p$DB_PASS")

echo "!! This DROPS and reloads '$PLATFORM_DB' and '$OPENEMR_DB' from snapshot '$STAMP'."
read -r -p "Type 'yes' to continue: " confirm
[ "$confirm" = "yes" ] || { echo "aborted."; exit 1; }

for db in "$PLATFORM_DB" "$OPENEMR_DB"; do
  echo "· recreating $db…"
  mysql "${auth[@]}" -e "DROP DATABASE IF EXISTS \`$db\`; CREATE DATABASE \`$db\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
done

echo "· loading platform snapshot…"
mysql "${auth[@]}" "$PLATFORM_DB" < "$platform_sql"
echo "· loading OpenEMR snapshot…"
mysql "${auth[@]}" "$OPENEMR_DB" < "$openemr_sql"

echo "✓ demo restored from snapshot '$STAMP'. Restart the app (pm2 restart clinic-web) if it caches anything."
