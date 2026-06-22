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

## Architecture

A single Node.js microservice following **Hexagonal / Ports & Adapters** with **light Domain-Driven Design**. The service is one of ~10 services in the platform; communication boundaries are HTTP (synchronous, via the gateway) and RabbitMQ (asynchronous, via a shared topic exchange). The composition root in `src/server.ts` is the only file that wires concrete adapters to the ports their dependents declare — every other file knows only the abstractions.

### Layer rule

Dependencies flow inward; arrows show what's allowed to `import` what. Violations fail CI (ESLint rule on import paths).

```
       ┌───────────────┐
       │  interfaces   │   (Express controllers, middleware, Zod request schemas)
       └───────┬───────┘
               │ depends on
               ▼
       ┌───────────────┐
       │  application  │   (use-cases, ports, DTOs — no framework imports)
       └───────┬───────┘
               │ depends on
               ▼
       ┌───────────────┐
       │    domain     │   (entities, value objects, domain events, errors)
       └───────▲───────┘
               │ implements ports declared in domain + application
       ┌───────┴───────┐
       │ infrastructure│   (Prisma, Redis, RabbitMQ, argon2, JWT)
       └───────────────┘
```

- **Domain layer** has **zero framework imports** — no Express, no Prisma, no Zod. It's portable to any runtime that speaks TypeScript.
- **Application layer** depends only on `domain/`. It declares **ports** (interfaces like `RateLimiter`, `EventBus`, `UnitOfWork`) that infrastructure adapters fulfil.
- **Infrastructure layer** imports concrete libraries and implements the ports. It's the only place where Prisma, ioredis, amqplib, jsonwebtoken, argon2 are mentioned.
- **Interfaces layer** orchestrates: parse → validate → call use-case → map result → respond. No business logic.

### Folder shape

```
src/
├── domain/                          # PURE — no framework imports
│   ├── shared/                      #   value objects (Email, HashedPassword), branded IDs,
│   │                                #     typed-error hierarchy (DomainError + subclasses,
│   │                                #     InvariantViolationError), Clock port, base DomainEvent
│   ├── user/                        #   User entity + UserRepository port + 6 user events
│   ├── refresh-token/               #   RefreshToken entity + repo port (with rotation invariants)
│   ├── password-reset/              #   PasswordResetToken entity + repo port
│   └── email-verification/          #   EmailVerificationToken entity + repo port
│
├── application/                     # use-cases + ports
│   ├── ports/                       #   UnitOfWork, EventBus, PasswordHasher, TokenHasher,
│   │                                #     TokenGenerator, RateLimiter, AccessTokenIssuer
│   ├── auth/                        #   9 public use-cases (register, login, logout, rotate-
│   │                                #     refresh, request/confirm-password-reset, verify-email,
│   │                                #     resend-verification, get-me)
│   └── admin/                       #   2 admin use-cases (change-user-role, unlock-user)
│
├── infrastructure/                  # adapters — implements ports from domain + application
│   ├── persistence/                 #   Prisma repos (×4) + mappers (×4) + AsyncLocalStorage-based UoW
│   ├── crypto/                      #   argon2id password hasher + SHA-256 token hasher + secure
│   │                                #     random token generator
│   ├── jwt/                         #   HS256 issuer + verifier (separate classes — issuer is in a
│   │                                #     port; verifier is an interface-layer helper)
│   ├── messaging/                   #   RabbitMQ event bus + envelope mappers
│   ├── rate-limit/                  #   Redis-backed rate limiter (sliding window, cooldown, daily cap)
│   ├── bootstrap/                   #   boot-time admin seed (idempotent)
│   └── shared/                      #   InfrastructureError
│
├── interfaces/http/                 # transport — Express
│   ├── controllers/                 #   auth-controller, admin-controller, health-controller
│   ├── middleware/                  #   request-id, JWT auth, role guard, RFC 7807 error mapper
│   ├── request-schemas.ts           #   Zod request body/param validation
│   ├── routes.ts                    #   mounts the routers
│   ├── errors.ts                    #   HttpError (transport-layer typed error)
│   └── express-augment.d.ts         #   adds ctx + auth? to every Express.Request
│
├── config/                          # env loading (Zod-validated, boot-time fail-fast)
└── server.ts                        # COMPOSITION ROOT — the only file that knows concrete types
```

### Patterns in use (and why)

| Pattern | Where | Why |
|---|---|---|
| **Hexagonal / Ports & Adapters** | `application/ports/` declared; `infrastructure/*` implements | swap adapters per environment (real Prisma in prod, in-memory fake in unit tests) without touching business logic |
| **Light DDD** | `domain/` entities + value objects with rich behavior; aggregate boundaries (User, RefreshToken, etc.) | business invariants live with the data; `cancel(reason)` instead of `setStatus(...)`; impossible to hold an invalid entity |
| **Repository pattern** | port in `domain/<aggregate>/<aggregate>-repository.ts`; impl in `infrastructure/persistence/prisma-<aggregate>-repository.ts` | use-cases never see Prisma; integration tests can substitute an in-memory `Map`-backed fake that obeys the same contract |
| **Unit of Work** | `PrismaUnitOfWork` + `AsyncLocalStorage` (`prisma-unit-of-work.ts`) | use-cases say `uow.run(async () => { ... })`; repositories transparently join the active transaction via `txOrPrisma(prisma)` without threading the tx through every call |
| **Use-case / Interactor** | one file per use-case in `application/{auth,admin}/`; class with `execute(input)` | each entry-point is a single class with explicit dependencies — easy to read, test, and grep for |
| **Domain events** | entities accumulate events via `pullEvents()`; use-cases publish after the transaction commits via the `EventBus` port | cross-aggregate effects flow through RabbitMQ, never through cascading FK writes |
| **Typed errors → RFC 7807** | `DomainError` + `HttpError` + `InfrastructureError` hierarchies; central middleware in `interfaces/http/middleware/error.ts` | controllers throw; middleware maps to `application/problem+json` with `type`, `code`, `status`, `retryAfterSeconds` for rate-limit cases |
| **Boot-time env validation (Fail Fast)** | `config/env.ts` uses Zod with `superRefine` for cross-field rules | bad env crashes the process before the first request — easier to debug than deferred runtime failures |
| **Composition root (DI)** | `server.ts` — only file that imports concrete adapters | dependency graph visible in one place; tests build their own composition (`tests/integration/helpers/build-test-app.ts`) without touching production wiring |
| **Branded types for IDs** | `UserId`, `RefreshTokenId`, `ResetTokenId`, `VerificationTokenId` in `domain/shared/ids.ts` | `string & { __brand: "UserId" }` prevents passing a `UserId` where a `RefreshTokenId` is expected — compile-time, no runtime cost |
| **Refresh token family revocation** | `RefreshToken.rotate()` + `RefreshTokenRepository.revokeFamilyForward()` | classic refresh-token-rotation pattern; reusing a revoked token revokes the entire descendant chain |
| **Idempotency-by-design** | seed-admin, logout, unlock — re-running produces the same end state | boot-time seed safe to redeploy; admin operations safe to retry |

### Testing strategy

| Layer | Style | Tooling | Count |
|---|---|---|---|
| `domain/` | **Strict TDD**; pure unit tests; no mocks | Jest + ts-jest | landed first per use-case |
| `application/` | **Strict TDD**; unit tests against in-memory **fakes** (not mocks) of every port | Jest + ts-jest + `tests/fakes/*` | majority of the 113 unit tests |
| `infrastructure/` | Risk-based **integration tests** | Jest + testcontainers (real Postgres / Redis / RabbitMQ) | 11 integration tests |
| `interfaces/` | Risk-based; one end-to-end HTTP flow exercises the full stack | Jest + supertest + testcontainers | the D47 flow test (golden register → login → /me → refresh → reuse → lockout → unlock) |

Total: **113 unit + 11 integration**, all green at `v0.1.1`. The integration tests caught a real FK-ordering bug in `RotateRefreshTokenUseCase` that the unit tests with fakes had missed (see `docs/superpowers/retros/1-auth-service.md`).

### Cross-service touchpoints

- **HTTP in:** all client traffic enters via the platform gateway; auth-service itself listens on `/auth/*` and `/healthz`/`/readyz`.
- **HTTP out:** none in Phase 1. (The `AUTH_SERVICE_JWT_SECRET` env var is declared for future service-to-service calls; unused now.)
- **AMQP out:** 6 events published to the `logistics.events` topic exchange (see §"Events published" below).
- **AMQP in:** none. Auth-service publishes; downstream services consume.
- **Database:** isolated Postgres (Neon in prod). No other service touches this database, ever.

---

## Local development

```bash
# 1. Bring up the platform infra stack (RabbitMQ + Redis)
cd ../logistics-infrastructure && ./scripts/bootstrap.sh && cd ../logistics-auth-service

# 2. Start the auth-service Postgres
docker compose -f docker-compose.dev.yml up -d

# 3. First-time only: install + migrate
npm install                                                    # @angelocp-01/logistics-contracts is public; no token needed
export AUTH_DB_URL="postgresql://auth:auth@localhost:5432/auth?schema=public"
npx prisma migrate deploy

# 4. Configure .env (one-time)
cp .env.example .env
# edit .env — generate the two JWT secrets with:
#   openssl rand -hex 32   (≥32 chars required by the env schema)

# 5. Run dev server (npm run dev auto-loads .env via tsx --env-file)
npm run dev
```

The Postgres data volume (`auth-pg-data`) persists across `docker compose down/up`. To reset to a clean DB:

```bash
docker compose -f docker-compose.dev.yml down -v   # the -v drops volumes
docker compose -f docker-compose.dev.yml up -d
npx prisma migrate deploy
```

## Tests

```bash
npm test               # unit (domain + application) — no containers
npm run test:int       # integration — testcontainers Postgres + Redis + RabbitMQ
npm run test:all       # both
```

## Exercise the service

Once the server is up (`npm run dev`), use the REST Client file at [`docs/auth-service.http`](docs/auth-service.http) to fire every endpoint. Open in VS Code with the `humao.rest-client` extension, then click "Send Request" above any block. Named requests (`# @name login`, `# @name refresh`, etc.) auto-capture tokens so subsequent requests use them via `{{login.response.body.accessToken}}` — no copy-paste.

The file includes:
- The full golden HTTP flow (register → login → me → refresh → reuse-detection → logout)
- Password reset + email verification round-trips
- Admin endpoints (with the `psql` one-liner for hand-promoting a user to admin)
- Negative-path probes (malformed email, wrong password, no auth, bogus JWT, forbidden) for spot-checking the RFC 7807 error shapes

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
| POST   | `/v1/auth/register`               | public                |
| POST   | `/v1/auth/login`                  | public                |
| POST   | `/v1/auth/logout`                 | bearer                |
| POST   | `/v1/auth/refresh`                | refresh-token-in-body |
| POST   | `/v1/auth/password-reset/request` | public                |
| POST   | `/v1/auth/password-reset/confirm` | public                |
| POST   | `/v1/auth/verify-email`           | public                |
| POST   | `/v1/auth/verify-email/resend`    | bearer                |
| GET    | `/v1/auth/me`                     | bearer                |
| POST   | `/v1/auth/users/{id}/role`        | bearer (admin)        |
| POST   | `/v1/auth/users/{id}/unlock`      | bearer (admin)        |
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

> Part of the [AI Logistics & Delivery Management Platform](https://github.com/AngeloCP-01/logistics-web#readme) — see the web repo for the full architecture overview.
