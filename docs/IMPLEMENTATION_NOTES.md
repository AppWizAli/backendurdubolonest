# Implementation notes

The initial code is intentionally a vertical security slice, not a fake declaration that every business endpoint is finished. Before production, add the remaining modules using the same boundaries:

```text
src/
  auth/
  catalog/
  content/
  subscriptions/
  access/
  playback/
  media/
  admin/
  notifications/
  reports/
  audit/
  common/
  prisma/
```

Each write path should follow this sequence:

1. Authenticate the session.
2. Validate the DTO and reject unknown fields.
3. Authorize the action and resource in the service query.
4. Perform related writes in a short Prisma transaction.
5. Write an audit event with the request ID.
6. Return a response DTO with an allowlist of fields.

The media gateway is a separate deployable boundary. It must validate the same signed capability, consult revocation/session state, enforce origin privacy, and stream/package content without exposing the provider locator. The main API must never proxy long media bodies.
