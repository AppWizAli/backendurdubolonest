# Pen-test acceptance checklist

## Authentication

- [ ] Login, refresh, recovery, MFA, and logout have independent rate limits.
- [ ] Passwords are Argon2id; generic failures do not reveal account existence.
- [ ] Refresh token rotation is atomic; reuse revokes the token family.
- [ ] Access tokens reject wrong issuer, audience, algorithm, signature, and expiry.
- [ ] Suspended/disabled users lose access immediately.

## Authorization

- [ ] Every route has an explicit public/authenticated/staff classification.
- [ ] Every object lookup includes the actor's allowed scope in the query.
- [ ] Changing `userId`, `role`, `status`, `groupId`, or ownership in request JSON cannot alter authorization.
- [ ] Direct grants and group grants are tested at start boundary, end boundary, revoked state, and deleted content.
- [ ] Staff permissions are tested across every role and tenant/scope boundary.

## Media

- [ ] API responses contain no raw MP4/M3U8 provider URL.
- [ ] Origin storage rejects public, unsigned, expired, wrong-user, and wrong-session requests.
- [ ] Playback capability expires quickly and cannot be used for a different asset/user/session.
- [ ] Playback revocation and account suspension are enforced at the media gateway.
- [ ] Premium offline playback uses DRM licenses; no playable plaintext file is written to shared storage.

## Input and API surface

- [ ] DTOs reject unknown properties, invalid UUIDs, oversized fields, and unexpected content types.
- [ ] Pagination, filters, sorting, upload size, and concurrency are bounded.
- [ ] No SSRF, path traversal, SQL injection, command injection, stored XSS, or unsafe deserialization path exists.
- [ ] CORS is exact; CSRF is enabled for cookie-authenticated admin routes.
- [ ] Swagger/debug/test routes are not public in production.

## Operations

- [ ] Secrets come from a secret manager and have a tested rotation process.
- [ ] Logs contain request IDs and audit events but no tokens, passwords, raw URLs, or sensitive bodies.
- [ ] Alerting exists for refresh reuse, impossible playback concurrency, mass grant changes, upload abuse, and repeated authorization failures.
- [ ] Backups are encrypted, access-controlled, and restore-tested.
- [ ] Dependency, container, SAST, DAST, and image scans run in CI.
