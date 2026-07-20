# Migration plan

## Phase 0: contain the current leak

1. Stop distributing the existing APK and disable legacy offline downloads.
2. Rotate database credentials, admin passwords, shared API tokens, Firebase service credentials, storage credentials, and any key found in the APK.
3. Make the storage origin private. Revoke or expire every public media URL that can be revoked.
4. Remove public access to dangerous legacy endpoints, especially unauthenticated account mutation, password mutation, file upload, and raw media retrieval routes.
5. Preserve a read-only forensic copy of legacy logs and the database before changing access.

## Phase 1: database migration

Create a mapping table from old integer IDs to new UUIDs. Import users with forced password reset unless password hashes are confirmed to be compatible. Import dramas, seasons, and episodes first. Convert each `video_path` to a provider asset identifier or encrypted locator. Do not import raw URLs into any client-facing table.

Import grants only after validating that the referenced user, group, episode, and dates exist. Reject orphaned or ambiguous rows into a quarantine report. Keep the legacy database read-only during the reconciliation window.

## Phase 2: parallel operation

Run the new API in shadow/read-only mode. Compare catalog counts, active users, grant decisions, and subscription end dates. Do not compare or copy provider URLs to application logs. Start with internal staff and a small user cohort.

## Phase 3: media cutover

Package premium video as HLS/DASH, enable Widevine where supported, and configure the media gateway so the storage origin accepts only gateway/provider credentials. Test expired capability, revoked account, revoked grant, wrong user, wrong device, replayed token, and direct-origin access.

## Phase 4: client and panel cutover

Release a new production-signed Android app with no backend/provider/Firebase-admin secrets. Launch the Next.js panel behind MFA and strict permissions. Force legacy app sessions to expire and block legacy API routes at the edge.

## Phase 5: retirement and verification

Retire the old PHP endpoints, remove public legacy files, rotate again, and commission an independent penetration test against the new API, media gateway, admin panel, Android release build, infrastructure, and recovery process.
