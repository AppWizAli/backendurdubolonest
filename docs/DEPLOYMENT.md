# Deployment

The release artifact is an immutable container image built by `.github/workflows/container.yml`. The workflow publishes commit and release tags to GHCR with provenance and an SBOM. Production should deploy a commit tag, never a mutable `latest` tag.

On the host, keep `docker-compose.production.yml` and a protected `.env.production`. Set `IMAGE_REPOSITORY` and `IMAGE_TAG`, then run:

```text
docker compose -f docker-compose.production.yml pull api
docker compose -f docker-compose.production.yml run --rm api npx prisma migrate deploy
docker compose -f docker-compose.production.yml up -d api
curl --fail http://127.0.0.1:3000/health/ready
```

The deployment workflow performs these steps over a host key restricted to the deployment machine. It verifies readiness and restores the explicitly supplied previous image tag if the new container cannot become ready. Database migrations are forward-only in deployment; a schema rollback requires a tested restore plan, not an automatic destructive command.

Terminate TLS and enforce the public firewall policy at the reverse proxy or managed ingress. Permit `/health/live` and `/health/ready` only as required by the load balancer. Permit `/internal/metrics` only from the monitoring network and require `X-Metrics-Token`.

Before enabling public traffic, verify the image digest, migration status, readiness, error rate, database pool saturation, Redis health, and backup freshness.
