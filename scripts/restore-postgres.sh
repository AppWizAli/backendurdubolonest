#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
file="${1:?Provide a verified PostgreSQL custom-format dump file}"
test "${CONFIRM_RESTORE:-}" = YES
test -f "$file"
pg_restore --list "$file" >/dev/null
pg_restore --dbname="$DATABASE_URL" --clean --if-exists --no-owner --no-privileges "$file"
printf '%s\n' "Restore completed. Run prisma migrate deploy and readiness checks before accepting traffic."
