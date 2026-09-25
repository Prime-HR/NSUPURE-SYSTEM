# Isolated staging deployment

This branch is for a disposable staging environment only. It combines the data-safe production corrections and authenticated field-app sync API.

## Required isolation

- Use a new, empty PostgreSQL database. Never paste or reuse the live Neon connection string.
- Set a new JWT secret and a unique initial owner password in the hosting dashboard.
- Set `CORS_ORIGINS` and `FRONTEND_URL` to the staging service's HTTPS URL.
- Do not run `prisma:deploy` on the staging database until its schema has been initialized for test use. The production additive upgrade is deliberately refused without current restore proof and an explicit stopped-writers attestation.

## Suggested Koyeb configuration

- Service: Web Service, Docker build, Dockerfile path `Dockerfile.staging`.
- Port: `10000`.
- Health check: `/ready`.
- Environment: `NODE_ENV=production`, `PORT=10000`, `DATABASE_URL`, `JWT_SECRET`, `INITIAL_OWNER_USERNAME`, `INITIAL_OWNER_PASSWORD`, `FRONTEND_URL`, `CORS_ORIGINS`.

The container builds application code only. It does not seed, reset, push, or migrate a database.
