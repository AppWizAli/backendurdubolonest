# Milestone 3 Completion Report

## 1. Features Implemented

Secure playback authorization, playback sessions, trusted devices, short-lived capability tokens, Redis capability state, replay detection, playback expiration, heartbeats, stop/resume, history, continue watching, recent playback, status, and a protected media gateway are implemented.

Playback authorization checks account status, subscription validity, episode publication and visibility, direct or group grants, grant dates/status, active media metadata, trusted device status, fingerprint binding, concurrent sessions, and capability scope.

## 2. Playback Architecture

The Android client authenticates with the normal account access token, registers a trusted device, and requests a playback session. The API returns an opaque playback session ID, a short-lived RS256 playback capability, an expiry, and a gateway path. It never returns the storage provider URL.

The gateway accepts the playback capability through an authorization header and requires device headers. It validates the session, Redis capability state, signature, expiry, device binding, account, subscription, grant, episode, and media status before every media request. The encrypted locator is decrypted only inside the gateway.

MP4 requests are streamed with range support. HLS and DASH manifests are rewritten so child resources use opaque gateway resource IDs stored in Redis. Provider hosts are allowlisted and each origin request receives a timestamped HMAC signature. Provider credentials and locators are not included in API responses or logs.

## 3. APIs Added

- `POST /api/v1/playback/episodes/:episodeId/session`
- `POST /api/v1/playback/sessions/:id/resume`
- `POST /api/v1/playback/sessions/:id/heartbeat`
- `DELETE /api/v1/playback/sessions/:id`
- `GET /api/v1/playback/sessions/:id/status`
- `GET /api/v1/playback/history`
- `GET /api/v1/playback/continue-watching`
- `GET /api/v1/playback/recent`
- `GET /api/v1/auth/devices`
- `DELETE /api/v1/auth/devices/:id`
- `GET /media-gateway/sessions/:sessionId/manifest`
- `GET /media-gateway/sessions/:sessionId/resources/:resourceId`

The gateway routes use the playback capability header, device ID, fingerprint header, and opaque resource/session IDs. They do not use permanent provider URLs.

## 4. Database Changes

Migration `prisma/migrations/0003_milestone3_playback/migration.sql` adds trusted devices, playback sessions, playback heartbeats, playback history, device/playback status enums, foreign keys, uniqueness constraints, indexes, and nonnegative position constraints.

Trusted devices are scoped to users and device IDs. Playback capabilities are stored only as hashes. Playback history is unique per user and episode and is updated as sessions resume.

## 5. Redis Usage

Redis stores active capability state with a TTL equal to the capability lifetime. Revocation deletes the capability state. HLS/DASH resource IDs map to upstream provider URLs only in Redis and expire with the playback session. No provider URL is written to the API response or client-facing logs.

## 6. Security Features

- RS256 capability signatures with issuer and media-gateway audience validation
- Short capability lifetime and Redis TTL
- Capability hash and JTI comparison against the database session
- Device ID and fingerprint hash binding
- Trusted-device revocation closes active playback sessions
- Subscription, grant, publication, media, and account checks before gateway access
- Replay, expiry, scope mismatch, and device mismatch detection
- Provider hostname allowlisting and HTTPS-only origin requests
- Timestamped HMAC origin authentication
- Range support without forwarding provider credentials
- Audit events for start, resume, end, denial, expiry, replay, device mismatch, and security violations

## 7. Android Integration APIs

The Android client uses account authentication and device registration, then calls the playback session endpoint. It supplies the returned playback capability in the gateway `Authorization` header and sends the device ID and fingerprint headers. Heartbeat, stop, resume, history, continue watching, recent, and status endpoints are available without exposing media storage information.

## 8. Test Coverage Summary

The verification suite includes playback policy tests for subscription, device, and concurrency denial; capability tests for replay, revoked sessions, expired capabilities, and device mismatch; locator cipher tests; media locator redaction tests; migration tests; authorization tests; and the existing Milestone 1 and 2 regression tests.

The latest verified suite contains 13 test suites and 21 passing tests. Prisma validation, TypeScript typecheck, Nest build, ESLint, and Jest are required verification commands.

## 9. Remaining Work for Milestone 4

Milestone 4 may add notifications, messages, comments, reports, dashboard, analytics, APK updates, banners, trending, and recommendations. DRM/license integration and watermarking remain deployment-specific work if the media policy requires them; later modules must not bypass this playback gateway or origin protection.
