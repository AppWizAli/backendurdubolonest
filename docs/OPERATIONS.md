# Operations

## Health and metrics

- `GET /health/live` confirms that the process is running.
- `GET /health/ready` confirms PostgreSQL and Redis connectivity.
- `GET /internal/metrics` exposes Prometheus text format and requires `X-Metrics-Token`.

The metrics registry includes Node process metrics, HTTP request totals, HTTP duration buckets, and the last observed PostgreSQL and Redis health values. Alert on readiness failure, sustained 5xx responses, p95 latency, pool saturation, Redis unavailable state, disk pressure, and backup age.

## Logs

Logs are JSON lines on stdout/stderr. Send them to a centralized system with restricted access and retention. Request logs include request ID, method, route, status, duration, IP, and bounded user-agent data. Tokens, request bodies, media locators, passwords, and provider URLs must not be logged.

Audit records are stored in PostgreSQL for security-sensitive actions. Restrict database access and retain audit data according to the business and legal retention policy.

## Maintenance

Run `npm run maintenance:cleanup` from a controlled job identity. It expires stale playback sessions, removes old playback heartbeats, and removes expired revoked refresh sessions. Keep the job single-instance or protect it with an external scheduler lock.

## Incident response

1. Preserve request, audit, database, ingress, and provider logs.
2. Revoke affected sessions and trusted devices.
3. Rotate signing, locator, provider-origin, database, Redis, and metrics credentials as indicated.
4. Disable affected media assets or providers if unauthorized access is suspected.
5. Capture a timeline, indicators, affected accounts, and evidence before cleanup.
6. Restore service only after readiness, authorization, and playback checks pass.
