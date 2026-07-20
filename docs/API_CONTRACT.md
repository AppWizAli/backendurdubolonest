# API contract v1

All routes are under `/api/v1`. JSON errors contain a status and request ID, not stack traces or SQL/provider details.

## Authentication

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | Public, throttled | Authenticate a user and create a server session |
| POST | `/auth/refresh` | Public, throttled | Rotate a refresh token; reuse detection is mandatory |
| POST | `/auth/logout` | Public with refresh token | Revoke a refresh session |
| POST | `/auth/logout-all` | User | Revoke all sessions after password change or compromise |
| POST | `/auth/mfa/verify` | Challenge | Complete staff MFA |

## Mobile catalog and playback

| Method | Route | Auth | Rule |
|---|---|---|---|
| GET | `/catalog/dramas` | User | Return published metadata only; cursor pagination |
| GET | `/catalog/dramas/{dramaId}` | User | Return only published seasons/episodes |
| POST | `/playback/episodes/{episodeId}/session` | User | Re-check entitlement and return a short-lived gateway URL |
| POST | `/playback/sessions/{sessionId}/heartbeat` | User | Update liveness/anomaly signals; never extend beyond policy automatically |
| DELETE | `/playback/sessions/{sessionId}` | User | Revoke the playback session |

## Staff APIs

Staff APIs are a separate controller namespace and separate permission policy. They never reuse mobile response DTOs.

| Method | Route | Permission |
|---|---|---|
| GET | `/admin/users` | `users.read` |
| PATCH | `/admin/users/{userId}/status` | `users.manage` |
| POST | `/admin/subscriptions` | `subscriptions.manage` |
| POST | `/admin/groups/{groupId}/members` | `access.manage` |
| POST | `/admin/episodes/{episodeId}/grants` | `access.manage` |
| POST | `/admin/dramas` | `content.write` |
| PATCH | `/admin/episodes/{episodeId}` | `content.write` |
| POST | `/admin/media/upload-intents` | `media.upload` |
| GET | `/admin/audit-events` | `audit.read` |

Every staff write requires a permission, object-level scope, CSRF protection when cookie-authenticated, and an audit event. Destructive actions require re-authentication or recent MFA.

## Response rules

- Use stable UUIDs, ISO-8601 timestamps, explicit enums, and pagination cursors.
- Never serialize Prisma models directly.
- Never return `passwordHash`, session hashes, internal provider names/locators, storage bucket names, or admin-only fields to mobile clients.
- Use `404` for unavailable content where revealing existence would help enumeration.
- Use `403` only after authentication when the resource's existence is not sensitive.
