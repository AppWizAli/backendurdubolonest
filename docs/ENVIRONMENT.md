# Production environment

Production values must come from a secret manager or protected deployment environment. Do not store `.env.production` in source control, container layers, tickets, or chat messages.

Required secret values are `DATABASE_URL`, `REDIS_URL`, `JWT_PRIVATE_KEY_B64`, `JWT_PUBLIC_KEY_B64`, `METRICS_TOKEN`, `ARGON2_DUMMY_HASH`, `MEDIA_LOCATOR_ENCRYPTION_KEY_B64`, and `MEDIA_PROVIDER_ORIGIN_SECRET`. `FIREBASE_SERVICE_ACCOUNT_B64` is optional and should be supplied from the secret manager when push delivery is enabled. Rotate signing, locator, origin, metrics, and Firebase credentials through a planned key-rotation procedure. Keep the database and Redis reachable only from the API private network.

`DATABASE_URL` should include a bounded pool, for example `connection_limit=20&pool_timeout=10`. Use TLS-capable PostgreSQL and Redis URLs in production. `PUBLIC_API_ORIGIN` and `ADMIN_WEB_ORIGIN` must be exact HTTPS origins. Keep `ENABLE_SWAGGER=false` in production.

Copy `.env.production.example` only as a naming reference. Replace every managed-secret marker in the deployment secret store before starting the service. The application refuses to boot when required configuration is missing or malformed.
