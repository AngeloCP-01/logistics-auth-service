# logistics-auth-service

Authentication service for the AI Logistics Platform. Owns user credentials, issues JWTs, and publishes user lifecycle events.

**Phase:** 1
**Spec:** [`docs/superpowers/specs/2026-05-20-auth-service-design.md`](../docs/superpowers/specs/2026-05-20-auth-service-design.md)
**Plan:** [`docs/superpowers/plans/2026-05-20-phase-1-auth-service.md`](../docs/superpowers/plans/2026-05-20-phase-1-auth-service.md)

## What this service does

- Registration (`customer` or `driver` via public endpoint; `admin` via boot-time seed + admin-only role-change endpoint)
- Login (HS256 access token 15 min + opaque refresh token 30 days)
- Refresh-with-rotation + reuse-detection (family revocation)
- Logout (single-row revoke; idempotent)
- Password reset (rate-limited, enumeration-resistant, always 202)
- Soft email verification (wired, not enforced at login in V1)
- Admin role elevation + admin lockout-clear
- Boot-time admin seed
- Six published events (see spec §4)

## Local development

```bash
# 1. Bring up the platform infra stack (RabbitMQ + Redis)
cd ../logistics-infrastructure && ./scripts/bootstrap.sh && cd ../logistics-auth-service

# 2. Start the auth-service Postgres
docker compose -f docker-compose.dev.yml up -d

# 3. First-time only: install + migrate
export NODE_AUTH_TOKEN=$(gh auth token)   # for @angelocp-01/logistics-contracts
npm install
export AUTH_DB_URL="postgresql://auth:auth@localhost:5432/auth?schema=public"
npx prisma migrate deploy

# 4. Run dev server (see README for full env-var list; .env.example documents them)
cp .env.example .env
# edit .env, then:
npm run dev
```

## Tests

```bash
npm test               # unit (domain + application) — no containers
npm run test:int       # integration — testcontainers Postgres + Redis + RabbitMQ
npm run test:all       # both
```

## Build + Docker

```bash
npm run build                   # tsc → dist/
DOCKER_BUILDKIT=1 docker build \
  --secret id=NODE_AUTH_TOKEN,env=NODE_AUTH_TOKEN \
  -t auth-service:local .
```

## Environment variables

See `.env.example`. Required:

- `AUTH_DB_URL` — Neon pooled endpoint in prod; local Postgres in dev
- `AUTH_JWT_SECRET` — ≥32 chars (access token signing)
- `AUTH_SERVICE_JWT_SECRET` — ≥32 chars (service JWT signing; declared, unused in Phase 1)
- `RABBITMQ_URL`, `REDIS_URL` — platform infra
- `LOG_LEVEL`, `LOG_SERVICE_NAME` — pino config
- `AUTH_SEED_ADMIN_EMAIL`, `AUTH_SEED_ADMIN_PASSWORD` — optional; if set, boot creates an admin (idempotent)
- `AUTH_RETURN_RESET_TOKEN`, `AUTH_RETURN_VERIFICATION_TOKEN` — dev flags; service refuses to start with these `true` in production

## HTTP endpoints

See `../logistics-contracts/openapi/auth-service.yaml` (v0.2.0) for the authoritative shape. Quick map:

| Method | Path                           | Auth                  |
| ------ | ------------------------------ | --------------------- |
| POST   | `/auth/register`               | public                |
| POST   | `/auth/login`                  | public                |
| POST   | `/auth/logout`                 | bearer                |
| POST   | `/auth/refresh`                | refresh-token-in-body |
| POST   | `/auth/password-reset/request` | public                |
| POST   | `/auth/password-reset/confirm` | public                |
| POST   | `/auth/verify-email`           | public                |
| POST   | `/auth/verify-email/resend`    | bearer                |
| GET    | `/auth/me`                     | bearer                |
| POST   | `/auth/users/{id}/role`        | bearer (admin)        |
| POST   | `/auth/users/{id}/unlock`      | bearer (admin)        |
| GET    | `/healthz`                     | public                |
| GET    | `/readyz`                      | public                |

All errors use RFC 7807 with `application/problem+json`. See spec §3.3 for the type-URI catalog.

## Events published (six)

- `user.registered`
- `user.email_verification_requested`
- `user.email_verified`
- `user.password_reset_requested`
- `user.password_changed`
- `user.role_changed`

Envelope: `logistics-contracts/schemas/event-envelope.json`. Routing keys map directly to event types. AsyncAPI catalog: `logistics-contracts/events/asyncapi.yaml`.

## Conventions

This repo follows the platform's coding-principles and coding-conventions documents (see CLAUDE.md for @-imports). Highlights:

- Layer rule: `interfaces → application → domain ← infrastructure`. Imports outside this direction are CI failures.
- Strict TDD on `domain/` and `application/`. Risk-based integration tests on `infrastructure/` and `interfaces/`.
- Errors: typed `DomainError` subclasses; central middleware maps to RFC 7807.
- Vendored configs: `tsconfig.base.json`, `eslint.config.mjs`, `prettier.config.mjs` are copies of the canonical at `logistics-infrastructure/shared/`.
