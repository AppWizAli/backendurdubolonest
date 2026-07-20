# Legacy migration utility

This utility imports the legacy MySQL dump into PostgreSQL. It is dry-run by default. Run it only against a restored copy of the legacy database and a staging PostgreSQL database first.

Required environment values:

- `LEGACY_DATABASE_URL`
- `DATABASE_URL`
- `ARGON2_DUMMY_HASH`
- `MIGRATION_RUN_ID` is optional and defaults to a generated identifier.
- `MIGRATION_MAX_ROWS` is optional and defaults to `100000`.

For the supplied phpMyAdmin SQL dump, also configure `MEDIA_LOCATOR_ENCRYPTION_KEY_B64` and `MEDIA_PROVIDER_ALLOWED_HOSTS`. Legacy media locators are encrypted before storage. A media asset is active only when its URL is HTTPS and its hostname is explicitly allowlisted.

Optional source table names are `LEGACY_USERS_TABLE`, `LEGACY_PLANS_TABLE`, `LEGACY_DRAMAS_TABLE`, and `LEGACY_SEASONS_TABLE`. Identifiers are validated before being used in SQL. The importer uses conservative common column names and records unmapped or invalid rows in `var/migration-reports`.

Commands:

```text
npx tsx scripts/legacy-migration/migrate.ts
npx tsx scripts/legacy-migration/migrate.ts --apply
npx tsx scripts/legacy-migration/import-sql.ts --file="E:/Company projects Work/_MAyPN23gE17/u223360224_urdubolodb2.sql"
npx tsx scripts/legacy-migration/import-sql.ts --file="E:/Company projects Work/_MAyPN23gE17/u223360224_urdubolodb2.sql" --apply
MIGRATION_RUN_ID=<run-id> npx tsx scripts/legacy-migration/verify.ts
MIGRATION_RUN_ID=<run-id> CONFIRM_ROLLBACK=YES npx tsx scripts/legacy-migration/rollback.ts
```

Only rows created by a run are recorded in `legacy_migration_records` and are eligible for rollback. Existing records are reported as duplicates and are not overwritten. Non-Argon2 legacy passwords are imported as disabled users with the configured timing-equalization hash; users must complete a controlled password reset before activation.
