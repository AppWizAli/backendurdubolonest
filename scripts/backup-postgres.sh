#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-var/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$BACKUP_DIR/urdubolo-$timestamp.dump"
umask 077
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$file"
sha256sum "$file" > "$file.sha256"
find "$BACKUP_DIR" -type f -name 'urdubolo-*.dump' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name 'urdubolo-*.dump.sha256' -mtime "+$RETENTION_DAYS" -delete
printf '%s\n' "$file"
