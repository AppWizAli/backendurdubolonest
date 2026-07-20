# Legacy database migration

The importer in `scripts/legacy-migration` is an operational utility, not an API. It reads only explicitly configured MySQL table names and is dry-run by default. Run it against a restored legacy copy and a staging PostgreSQL database before production.

The first pass supports users, subscription plans, dramas, and seasons through configurable table names and common source column names. Invalid rows and duplicates are preserved in a JSON report. Existing target records are not overwritten. Non-Argon2 password hashes result in disabled accounts with a timing-equalization hash, followed by a controlled password reset and activation process.

Recommended sequence:

1. Take and verify a legacy MySQL backup.
2. Apply all PostgreSQL migrations with `npx prisma migrate deploy`.
3. Set `LEGACY_DATABASE_URL`, `DATABASE_URL`, `ARGON2_DUMMY_HASH`, and source table variables.
4. Run `npx tsx scripts/legacy-migration/migrate.ts` and inspect `var/migration-reports`.
5. Resolve mapping errors and duplicates; do not apply a report with unexpected counts.
6. Run the importer with `--apply` using a new `MIGRATION_RUN_ID`.
7. Run `npx tsx scripts/legacy-migration/verify.ts` with that run ID.
8. Reconcile counts and sample relationships with the legacy export.
9. Keep the run ID and report with the release evidence.

Rollback is run-scoped and requires `CONFIRM_ROLLBACK=YES`. It removes only rows recorded as created by that run and reports rows that cannot be removed because later data depends on them. A failed rollback must be handled from the report, not by deleting unrelated records.
