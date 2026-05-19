# logistics-auth-service — Repo Guide

> Registration, login, refresh, role-based JWT issuance. The only service that mints tokens.

**Phase:** 1 (Auth Service)
**Status:** ⬜ Not started — scaffold only. Brainstorm an Auth spec before implementation.

## What this service does

Owns user identity and authentication. Issues access + refresh tokens, validates credentials, manages roles, handles password reset, publishes lifecycle events (currently `user.registered`).

This service is the source of truth for credentials. User profile data (display name, address, preferences) lives in `logistics-user-service`.

## Locked decisions

- **Tech**: Node 20 LTS, TypeScript, Express, Prisma + Neon Postgres, Jest.
- **JWT**: HS256 (V1). Access token 15 min. Refresh token 30 days.
- **JWT claims**: `sub` (user id, UUID v4), `role`, `iat`, `exp`. Service-JWT for internal calls uses the same shape but with a different `aud` (service name).
- **Password hashing**: argon2id (defaults). Never bcrypt for new services.
- **Roles**: enum at registration. V1 values: `customer`, `driver`. Admin is provisioned manually (no public registration endpoint).
- **Events published**: `user.registered` (envelope per `logistics-contracts/schemas/event-envelope.json`).
- **Public endpoints** (via gateway): `/v1/auth/register`, `/v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/password-reset/*` (TBD per spec), `/healthz`, `/readyz`.

## Database (Neon Postgres)

Schema (finalized in Auth spec):
- `users` — id, email (unique), password_hash, role, created_at, updated_at, status (`active` / `disabled`).
- `refresh_tokens` — id, user_id, token_hash, expires_at, revoked_at, created_from_ip, user_agent.
- (Password reset tokens table — design TBD per Auth spec.)

Migrations: Prisma Migrate. One migration per logical change. No squashing post-merge.

## Conventions

- Same as platform: pino, Zod, `/healthz` + `/readyz`, RFC 7807, Conventional Commits.
- Service folder shape: `src/{domain,application,infrastructure,interfaces,config}`. See platform CLAUDE.md.
- Env prefix: `AUTH_*` (e.g., `AUTH_DB_URL`, `AUTH_JWT_SECRET`, `AUTH_REFRESH_SECRET`).

## Open items (decide in the Auth spec)

These are deferred from the decomposition spec and need their own brainstorming session:
- Exact role taxonomy (do we add `admin` as a registerable role gated by invite? add `dispatcher`? other internal roles?)
- Refresh token rotation strategy (rotate on every use? on configurable interval?)
- Password reset flow (token TTL, single-use, email template, rate limit per email)
- Account lockout policy (failed login attempts, lockout duration)
- Email verification (required at registration? deferred?)

## Don't do

- Don't store profile data here. That's `user-service`'s job. Only credentials + roles.
- Don't issue tokens with role mutations baked in. Roles are read-only from this service's POV after registration. Role changes are an admin action.
- Don't expose `/users` endpoints here. The user-service owns those.
- Don't return raw error messages from Prisma or bcrypt to clients. Always map to Problem Details.

## Pointers

- Spec: [`../docs/superpowers/specs/2026-05-18-platform-decomposition-design.md`](../docs/superpowers/specs/2026-05-18-platform-decomposition-design.md) §4.1 (HTTP), §4.3 (events)
- OpenAPI skeleton: [`../logistics-contracts/openapi/auth-service.yaml`](../logistics-contracts/openapi/auth-service.yaml) (after Phase 0)
- Plan: TBD (brainstorm + plan in Phase 1)
- Tracker: [`../docs/superpowers/tracker.md`](../docs/superpowers/tracker.md)
