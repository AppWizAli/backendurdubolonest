# Production-readiness audit

Audit date: 2026-07-17

Scope: all 31 project files present at audit time, including every TypeScript file, Prisma schema, configuration file, Docker Compose file, package manifest, README, architecture document, API contract, migration plan, and penetration-test checklist. This is a read-only review; application source was not changed.

Baseline: OWASP API Security Top 10 2023, OWASP ASVS, NestJS security guidance, and Prisma PostgreSQL practices.

## 1. Executive Summary

This project is a readable security-oriented foundation, not a production backend. It currently implements only three authentication endpoints and one playback-session endpoint. The documented catalog, admin, subscription, media-gateway, audit, notification, reporting, and upload systems do not exist in code.

The highest-risk issue is the gap between the documentation and the executable system. The playback query does not require `EpisodeGrant.status = ACTIVE`, does not check the `Subscription` model, and the separate media gateway that is supposed to protect the provider origin is not present in this repository. The project also has no Prisma migrations, no lockfile, no tests, no request logging, no audit writes, and no Redis integration.

Do not expose this project to users or connect it to production content until the critical findings below are closed and an independent penetration test passes.

## 2. Architecture Score

2/10. The intended separation is sensible, but most bounded contexts are documentation only. The current executable architecture is a small NestJS process connected to PostgreSQL; it has no catalog, admin, subscription, media gateway, worker, audit pipeline, or health/readiness boundary.

## 3. Security Score

2/10. Good foundations include Argon2 verification, RS256 configuration, strict DTO pipe settings, global authentication, and short-lived playback capabilities. They are outweighed by missing MFA, missing permissions, missing audit/logging, a fail-open role design, incomplete entitlement checks, public Swagger when enabled, in-memory rate limiting, and no implemented gateway/origin enforcement.

## 4. Database Score

3/10. UUIDs, foreign keys, indexes, soft-delete fields, and explicit session/grant tables are good choices. There are no migrations, no database check constraints for business invariants, no retention strategy, no self-relation for refresh replacement, and no schema support for several documented audit/payment/access requirements.

## 5. API Score

2/10. Versioning and a basic error envelope exist, but only four routes are implemented, path UUID validation is missing, response DTOs are missing, route-specific throttles are missing, and the documented API inventory does not match the application.

## 6. Performance Score

3/10. The entitlement query is bounded and selects a small projection. There is no Redis use, no query timeout policy, no cleanup job for sessions, no connection-pool plan, no pagination implementation, no health telemetry, and no load test evidence.

## 7. Code Quality Score

5/10. The code is small, readable, dependency-injected, and contains useful security comments. It has no lint configuration, no tests, unused dependencies/imports, incomplete return typing, no DTO response layer, and a large implementation/documentation mismatch.

## 8. Scalability Score

2/10. The stateless HTTP direction is reasonable, but the throttler is process-local, PostgreSQL is the only real service, media streaming is not implemented, audit/analytics retention is absent, and there is no horizontal-scaling or failure-mode test.

## 9. Production Readiness Score

1/10. This is not deployable as the described streaming platform. The `prisma:migrate` command has no migration directory to deploy, and the essential product modules are absent.

## 10. Critical Issues

### C1. No Prisma migrations exist

`package.json:17` runs `prisma migrate deploy`, but the project contains only `prisma/schema.prisma` and no `prisma/migrations` directory. A fresh environment cannot create the database and the documented startup sequence fails.

Required fix: generate reviewed SQL migrations, include them in version control, add a CI `prisma validate` and migration smoke test, and never use `db push` for production.

### C2. The described platform is not implemented

Only `POST /api/v1/auth/login`, `refresh`, `logout`, and `POST /api/v1/playback/episodes/:episodeId/session` are executable. The catalog, admin, access-management, subscription, notification, reporting, upload-intent, audit, heartbeat, and playback-revocation routes in `docs/API_CONTRACT.md` do not exist.

Required fix: treat the current code as a foundation milestone, not a completed backend. Implement each bounded context with tests before migration or user rollout.

### C3. Playback authorization is incomplete

`src/playback/playback.service.ts:23` checks `revokedAt` but not `status = ACTIVE`. A revoked enum state with a null timestamp can still authorize playback. The `Subscription` model is never checked, despite the documented paid-access rule. There is also no implemented media gateway to enforce the signed capability or protect the storage origin.

Required fix: require active grant status, validate subscription policy in the same authorization decision, and deploy/test the gateway before returning any playback capability.

### C4. Swagger is public whenever enabled

`src/main.ts:41` mounts `/internal/docs` and its JSON document without an authentication guard, IP restriction, or internal network requirement. The comment says it is internal, but the code does not enforce that.

Required fix: compile Swagger only for non-production builds, or place it behind an authenticated internal route and network allowlist.

### C5. No security or audit logging is implemented

`pino-http` and `LOG_LEVEL` are declared but unused. No login, failed-login, refresh reuse, playback, grant, admin, or denial event is written to `AuditEvent`. The schema alone does not create an audit trail.

Required fix: add structured redacted request logging, an audit service, append-only audit writes, retention, and alerts for refresh reuse, mass grants, authorization failures, and abnormal playback.

### C6. Rate limiting is process-local and too generic

`src/app.module.ts:16` configures one global limit of 120 requests per minute. `redis` is not integrated. In a multi-instance deployment, attackers receive a separate bucket per instance; login and refresh have no stricter policy, account lockout, or IP/device anomaly controls.

Required fix: use shared Redis-backed throttling plus route-specific limits for login, refresh, recovery, grants, upload intents, and playback. Do not trust spoofable forwarded IP headers without a verified proxy chain.

### C7. Playback route does not validate the path UUID

`src/playback/playback.controller.ts:14` accepts an arbitrary string. Malformed values reach Prisma and can become database exceptions returned as 500 responses, creating avoidable noise and a resource-exhaustion path.

Required fix: use `ParseUUIDPipe` or a validated params DTO and return 400 for malformed identifiers.

### C8. No dependency lockfile or dependency audit baseline

There is no `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`. The `^` ranges in `package.json:21` can resolve different dependency trees over time. `npm audit` could not complete in this environment, so no vulnerability claim can be made from this manifest alone.

Required fix: choose npm/pnpm, commit one lockfile, run `npm ci`/equivalent in CI, pin and review updates, and publish an audit/SBOM report.

### C9. No tests exist

The `test` script exists at `package.json:14`, but no test/spec files are present. Authentication rotation, authorization boundaries, malformed UUIDs, revoked grants, subscription expiry, and media capability replay are therefore unverified.

Required fix: add unit, integration, database, contract, negative-security, and concurrency tests before any production migration.

## 11. High Severity Issues

- `src/common/auth/roles.guard.ts:15` is fail-open for any authenticated route without `@Roles`. It provides roles, not the documented permission system. Admin controllers must fail closed and require explicit permission metadata.
- There is no MFA, recovery flow, account lockout, login-attempt record, or staff re-authentication for high-risk actions.
- `ARGON2_DUMMY_HASH` is only checked for length at `src/config/env.validation.ts:22`; the example value is not a valid Argon2 hash. Invalid values make unknown-account verification fail quickly and weaken timing equalization.
- `src/main.ts:12` does not set explicit body-size limits, request timeouts, or content-type restrictions. The API has no upload boundary or resource-consumption policy in code.
- `src/main.ts:19` installs `cookie-parser` but no cookie-authentication or CSRF design exists. If the future admin panel uses cookies, current global setup is incomplete.
- `src/main.ts:24` treats `PUBLIC_API_ORIGIN` as a CORS origin. That is normally an API URL, not a browser origin. CORS should be an explicit list of trusted browser origins only.
- `src/playback/playback.service.ts:26` and `:27` create multiple `Date` values, and the database expiry at `:45` is calculated separately from the signer expiry. Capability expiry and stored-session expiry can drift.
- `src/playback/media-signer.service.ts:21` places the user UUID in a query string. URLs are commonly captured by proxy, browser, CDN, and analytics logs. Use an opaque capability ID and server-side lookup instead.
- `src/playback/playback.service.ts:49` stores a hash of the entire URL. A real gateway is absent, and a gateway depending on exact URL reconstruction is brittle. Store a dedicated capability nonce/hash and canonical claims.
- `src/playback/playback.service.ts:16` accepts a client-provided device ID but does not bind it to an attested device or enforce device/session concurrency.
- `src/prisma/schema.prisma:166` permits an episode grant with both `userId` and `groupId` null, or both populated. It also lacks `startsAt < endsAt` constraints. These are authorization data-integrity defects.
- `src/prisma/schema.prisma:18` uses a case-sensitive unique email. Application lowercasing at login does not prevent duplicate values inserted through future admin/import paths.
- `src/prisma/schema.prisma:58` and `:59` have no positive-value constraints; subscription state has no status, actor, payment record, or audit relation.
- `src/prisma/schema.prisma:185` has no cleanup/partition plan. Playback sessions and audit events will grow without bound.
- `src/prisma/schema.prisma:46` stores `replacedById` without a self-relation or foreign key, so refresh-token lineage cannot be integrity-checked.
- `src/prisma/schema.prisma:133` claims an encrypted media locator but no encryption/decryption/key-version service exists. A text field is not encryption at rest by itself.
- `docker-compose.yml:3` and `:15` use mutable image tags; Redis has no password/TLS; PostgreSQL has a committed local password. This is acceptable only as clearly isolated local development, never as production infrastructure.
- No readiness/liveness endpoints, graceful shutdown hooks, connection-pool policy, or dependency health checks are implemented.

## 12. Medium Severity Issues

- No explicit response DTOs or serialization allowlists exist; controllers return service objects directly.
- The global exception filter removes validation detail and uses a nonstandard envelope without an error code/type taxonomy, making clients and observability weaker.
- Request IDs are accepted from clients. They are bounded, but a server-generated ID plus a separately recorded external correlation ID is safer for log integrity.
- `LOG_LEVEL`, `pino-http`, and `redis` are dead configuration/dependencies, creating false confidence.
- `ForbiddenException` is unused in playback service.
- No API decorators/tags/security metadata exist, so generated Swagger will be incomplete.
- No input normalization/trim policy is applied to email or device IDs.
- No explicit PostgreSQL TLS requirement, secret-manager integration, or RSA key-pair validation exists in environment validation.
- No admin/user ownership or actor fields are present on content, group, grant, and subscription records.
- Cascading deletes on grants and playback sessions can erase security history if hard deletes are ever introduced.
- No CDN cache policy, catalog cache, query timeout, or load-test result exists.
- No CI workflow, SAST, dependency scanning, container scanning, SBOM, backup test, or restore test is present.

## 13. Low Severity Issues

- `tsconfig.json` defines a path alias that is not used and does not configure a runtime alias loader.
- `.gitignore` does not exclude TypeScript incremental state such as `*.tsbuildinfo`.
- No ESLint 9 flat configuration is included, so the lint script is not reproducible.
- Docker Compose has no healthchecks or resource limits, which reduces local failure-simulation quality.
- The API contract documents routes and features that are not marked as planned/stubbed in the runtime.

## 14. Missing Features

Admin panel API, user registration/recovery, MFA, permissions, catalog, dramas, seasons, episodes, subscriptions, manual payment records, group/access management, media ingest, private storage adapter, media gateway, DRM/license service, watermarking, notifications, reports, audit API, playback heartbeat/revocation, health checks, metrics, tracing, background workers, data retention, migrations, seeds, tests, CI/CD, backup/restore, WAF/edge policy, and mobile attestation are missing.

## 15. Security Improvements

1. Block external deployment until C1-C9 are closed.
2. Implement a permission model and make admin routes fail closed.
3. Add MFA, recovery tokens, lockout/risk controls, re-authentication, and security event alerts.
4. Move rate limits, session revocation cache, and replay detection to Redis with bounded TTLs.
5. Complete the media gateway, private origin policy, capability validation, DRM, watermarking, and revocation checks.
6. Add authenticated encryption for provider locators with key versioning and rotation.
7. Add redacted structured logs, append-only audit events, and retention controls.
8. Add exact CORS, explicit body/response limits, timeouts, content-type checks, and proxy configuration validation.

## 16. Performance Improvements

Use a connection-pool/PgBouncer plan, cursor pagination, bounded selections, query timeouts, Redis-backed catalog caching, async audit/analytics workers, playback-session cleanup, database partitioning for high-volume event tables, CDN delivery for manifests/segments, and load tests for login, catalog, entitlement checks, and playback-session creation.

## 17. Database Improvements

Add migrations and reviewed SQL constraints: `user_id XOR group_id`, positive date windows, positive plan values, case-insensitive email uniqueness, active-state consistency, and provider allowlists. Add actor/version fields, payment records, permission tables, grant history, refresh-token family relations, retention indexes, and an append-only audit storage policy.

## 18. API Improvements

Separate `/api/v1/mobile`, `/api/v1/admin`, and `/api/v1/internal` policies. Validate every path/query/body value, use response DTOs, define stable error codes, enforce cursor limits, add route-specific throttles, add idempotency keys for staff writes, require CSRF for cookie-authenticated admin actions, and keep OpenAPI internal-only.

## 19. Code Improvements

Add `AuthPolicy`, `PermissionGuard`, `AuditService`, `MediaGatewayClient`, `SubscriptionPolicy`, `HealthModule`, `RequestLoggingInterceptor`, `RedactionSerializer`, and repository/service tests. Return explicit Promise types. Remove unused dependencies or implement them. Add ESLint/Prettier/CI configuration and commit a lockfile.

### Corrected authorization pattern

```ts
const now = new Date();
const episode = await prisma.episode.findFirst({
  where: {
    id: episodeId,
    deletedAt: null,
    isPublished: true,
    grants: {
      some: {
        status: GrantStatus.ACTIVE,
        revokedAt: null,
        startsAt: { lte: now },
        endsAt: { gt: now },
        OR: [
          { userId: principal.id },
          { group: { members: { some: {
            userId: principal.id,
            revokedAt: null,
            startsAt: { lte: now },
            endsAt: { gt: now },
          } } } },
        ],
      },
    },
  },
  select: { id: true, mediaAsset: { select: { id: true } } },
});
```

Add the subscription predicate according to the final business rule, and validate `episodeId` with `ParseUUIDPipe` before this query.

### Corrected database invariants

The first migration should add PostgreSQL checks equivalent to:

```sql
CHECK ((user_id IS NULL) <> (group_id IS NULL));
CHECK (starts_at < ends_at);
CHECK (price_pkr >= 0 AND duration_days > 0);
```

## 20. Final Recommendation

Reject production deployment. Keep this repository as the security foundation, then implement the missing bounded contexts and media gateway in controlled milestones. The first release gate is: migrations apply cleanly, all security-sensitive flows have tests, active subscription/grant authorization is correct, Redis-backed throttling works across two instances, audit logs are observable, origin storage is private, and the Android client receives only short-lived DRM/gateway capabilities. After that gate, commission an independent penetration test before migrating paying users.
