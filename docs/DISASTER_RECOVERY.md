# Disaster recovery

## Targets

The initial production target is an RPO of 15 minutes where the managed PostgreSQL service supports continuous WAL/PITR, and an RTO of 60 minutes for a regional service failure. If the selected provider cannot meet those targets, record the lower target in the service runbook before launch.

## Backups

Run `scripts/backup-postgres.sh` or `scripts/backup-postgres.ps1` at least daily, and use managed PostgreSQL PITR for the 15-minute objective. Store encrypted backups in a separate account or region with restricted write and restore roles. The scripts create custom-format dumps and checksums. Run the matching verification script after every backup and before any restore exercise.

## Restore exercise

1. Provision an isolated PostgreSQL instance of the supported major version.
2. Verify the dump checksum and `pg_restore --list` output.
3. Set `CONFIRM_RESTORE=YES` only in the isolated restore environment.
4. Run the restore script, then `npx prisma migrate deploy`.
5. Start the API with staging secrets and run readiness, authentication, authorization, and playback smoke checks.
6. Record elapsed time, data loss, failed checks, and corrective actions.

Never restore over production without a written incident approval and a current backup. A media provider outage requires provider recovery or locator rotation; the PostgreSQL restore does not recreate media objects stored outside the database.

## Recovery evidence

Record backup timestamp, checksum, database version, migration status, restore duration, readiness result, and the person approving the exercise. Review this evidence quarterly and after infrastructure changes.
