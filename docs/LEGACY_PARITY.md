# Legacy Business Parity

The NestJS API is the secure implementation of the business workflows found in the PHP admin panel and mobile API. Legacy media URLs are never returned: episode media is represented by encrypted locators and delivered through the capability-authorized media gateway.

## Implemented Areas

- Authentication, sessions, refresh rotation, device registration, account status, password change, lockout, and audit logging.
- Users, profiles, suspension/activation, search, pagination, and administrative role assignment.
- Roles, permissions, custom role management, user permissions, and permission guards.
- Subscription plans, manual payment records, subscription requests, approval/rejection, extension, cancellation, and group membership activation.
- Access groups, dated members, direct episode grants, group episode grants, grant history, and access validation.
- Drama, season, episode, media asset, publication, deletion/restore, and bulk administration.
- Notifications, Firebase delivery, user/group messages, banners, trending dramas, remote configuration, app release metadata and provider-proxied APK downloads.
- Security blocks, security incident reporting, comments, view tracking, analytics, dashboard counts, and global search.

## Main Compatibility Routes

All routes use `/api/v1` and the existing JWT/permission guards.

- `/notifications`, `/messages`, `/banners`, `/trending`
- `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`
- `/app/releases`, `/app/releases/latest`, `/app/releases/:id/download`
- `/remote-config`, `/admin/remote-config`
- `/subscription/settings`, `/subscription/requests`
- `/security/block-status`, `/security/incidents`
- `/episodes/:episodeId/comments`, `/comments`
- `/analytics/views`, `/reports/dashboard`, `/search`
- `/admins`, `/admins/:userId/roles`

## Deliberate Secure Differences

- PHP public MP4/M3U8 paths and query-string playback sessions are replaced by encrypted media locators, short-lived RS256 playback capabilities, device binding, Redis state, and provider-origin signing.
- PHP filesystem uploads and public filename URLs are not accepted. Media and APK storage must be supplied through an allowlisted HTTPS provider or a future presigned-upload adapter.
- Legacy integer IDs are not reused in the new database. The migration scripts maintain an explicit legacy-ID mapping.
- Legacy `registration` is an obsolete registration log without a user-facing workflow; authentication registration is represented by the new `users` and audit records.
- The legacy `videos` table is an empty compatibility table in the supplied dump and its active workflows refer to episode IDs. Episode grants and the media asset model are therefore the canonical replacement.
- No PHP cron definition was present in the supplied panel. Maintenance is exposed through the authenticated operational scripts and deployment scheduler configuration.

## Storage and Firebase Requirements

Set `MEDIA_PROVIDER_ALLOWED_HOSTS`, `MEDIA_PROVIDER_ORIGIN_SECRET`, and the media encryption key before creating media assets. Set `FIREBASE_SERVICE_ACCOUNT_B64` only when push delivery is required; the service is otherwise a safe no-op.
