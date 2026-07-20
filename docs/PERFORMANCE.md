# Performance and capacity

The API uses bounded request bodies, strict pagination DTOs, response compression, Redis for short-lived playback and rate-limit state, and PostgreSQL indexes for access, subscription, content, session, and audit lookups. Milestone 5 adds composite episode indexes for common catalog and administration filters.

Set a bounded Prisma pool in `DATABASE_URL`. Monitor connection usage rather than increasing the pool blindly. Keep playback heartbeats bounded by the client heartbeat interval and retain them for the configured operational period. Run maintenance as a single controlled background job.

The built-in load runner is intentionally conservative and defaults to the liveness route:

```text
LOAD_TEST_BASE_URL=https://staging.example.com LOAD_TEST_CONCURRENCY=50 LOAD_TEST_REQUESTS=5000 npm run load:test
```

Run authentication and playback load only in staging with test accounts, test media, and provider approval. Capture p50, p95, p99, error rate, database pool usage, Redis latency, CPU, memory, and provider response time. No production load test was executed from this workstation because no production-like service endpoint was supplied.
