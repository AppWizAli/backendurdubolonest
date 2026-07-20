# Urdu Bolo Secure Backend

NestJS, Prisma, PostgreSQL, and Redis backend for the Urdu Bolo platform. This repository currently implements Milestones 1, 2, and 3: the secure platform core, content/media metadata administration, and protected playback.

## Milestone 1

- PostgreSQL schema and migration in `prisma/migrations/0001_milestone1`.
- Redis-backed rate limiting and health/readiness checks.
- Request IDs, structured request logs, audit events, secure exception responses, graceful shutdown, and strict input validation.
- Argon2id passwords, RS256 access tokens, hashed rotating refresh tokens, session/device management, lockout, password change, revocation, and login history.
- User CRUD, profile updates, search, filtering, pagination, suspension, activation, and soft deletion.
- Role and permission CRUD, assignments, and permission enforcement for Super Admin, Admin, Sub Admin, Moderator, and User.
- Subscription plans, subscriptions, history, manual payments, extensions, cancellation, and entitlement validation.
- Access groups, members, direct grants, group grants, grant history, revocation, and access validation.

## Milestone 2

- Drama, season, and episode CRUD with soft delete, restore, publishing, search, filtering, sorting, pagination, thumbnails, visibility, and premium/free flags.
- Relationship integrity for drama to seasons, seasons to episodes, and episodes to one media asset.
- Media asset metadata CRUD with provider metadata, encrypted locator storage, media type/status, versioning, metadata, checksums, and lifecycle state. API responses never include the encrypted locator.
- Bulk content publish, unpublish, delete, and restore operations with audit records.
- Published, public, non-deleted content is the only catalog content returned to ordinary authenticated users.

## Milestone 3

- Playback sessions require an active account, subscription, episode grant, published episode, active media asset, trusted device, and matching fingerprint.
- Playback capabilities are short-lived RS256 tokens bound to an opaque session, device ID, and fingerprint hash. Capability state is cached in Redis and revocation removes the cache entry.
- The media gateway decrypts provider locators only server-side, signs origin requests, allowlists provider hosts, supports range streaming, and rewrites HLS/DASH resource references to opaque gateway resources.
- Playback heartbeats, stop/resume, expiration, revocation, history, continue watching, recent playback, and status are implemented.

Playback APIs never return permanent MP4/M3U8 URLs, provider credentials, encrypted locators, or internal provider metadata.

Notifications, messages, comments, reports, dashboard, analytics, APK updates, banners, trending, and recommendation APIs remain later-milestone work.

## Milestone 5

- Production environment and Docker hardening, immutable image CI/CD, readiness-gated deployment, and image rollback.
- Prometheus metrics at protected `/internal/metrics`, request latency telemetry, and PostgreSQL/Redis health gauges.
- Legacy MySQL migration utilities with dry-run, duplicate detection, reports, verification, and run-scoped rollback.
- PostgreSQL backup, checksum verification, restore scripts, maintenance cleanup, load-test runner, and disaster recovery guidance.
- Production environment, deployment, operations, performance, migration, and final QA documentation.

See `docs/PRODUCTION_READINESS_REPORT.md` for release gates and remaining risks.

## Local setup

1. Copy `.env.example` to `.env` and replace every sample value with local development values.
2. Start PostgreSQL and Redis with `docker compose up -d postgres redis`.
3. Run `npm install` and `npm run prisma:generate`.
4. Apply migrations with `npm run prisma:migrate`.
5. Set `SEED_SUPER_ADMIN_EMAIL` and `SEED_SUPER_ADMIN_PASSWORD`, then run `npm run prisma:seed`.
6. Start the API with `npm run start:dev`.

Swagger is disabled by default. Enable it only for a protected internal environment with `ENABLE_SWAGGER=true`.

## Verification

```text
npm run prisma:validate
npm run typecheck
npm run lint
npm test
npm run build
```

The current completion status and endpoint inventory are in `docs/MILESTONE_3_COMPLETION.md`.
