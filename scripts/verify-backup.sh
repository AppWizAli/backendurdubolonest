#!/usr/bin/env sh
set -eu
file="${1:?Provide a PostgreSQL custom-format dump file}"
test -f "$file"
test -f "$file.sha256"
sha256sum --check "$file.sha256"
pg_restore --list "$file" >/dev/null
printf '%s\n' "Backup verified: $file"
