-- Enable the citext extension before any column references it.
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('customer', 'driver', 'admin');
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');

-- CreateTable
CREATE TABLE "users" (
    "id"                UUID            NOT NULL,
    "email"             CITEXT          NOT NULL,
    "password_hash"     TEXT            NOT NULL,
    "role"              "Role"          NOT NULL,
    "status"            "UserStatus"    NOT NULL DEFAULT 'active',
    "email_verified_at" TIMESTAMPTZ(6),
    "created_at"        TIMESTAMPTZ(6)  NOT NULL,
    "updated_at"        TIMESTAMPTZ(6)  NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id"               UUID            NOT NULL,
    "user_id"          UUID            NOT NULL,
    "token_hash"       TEXT            NOT NULL,
    "expires_at"       TIMESTAMPTZ(6)  NOT NULL,
    "revoked_at"       TIMESTAMPTZ(6),
    "replaced_by_id"   UUID,
    "created_from_ip"  INET            NOT NULL,
    "user_agent"       TEXT            NOT NULL DEFAULT '',
    "created_at"       TIMESTAMPTZ(6)  NOT NULL,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_id_fkey"
  FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL;

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id"          UUID            NOT NULL,
    "user_id"     UUID            NOT NULL,
    "token_hash"  TEXT            NOT NULL,
    "expires_at"  TIMESTAMPTZ(6)  NOT NULL,
    "used_at"     TIMESTAMPTZ(6),
    "created_at"  TIMESTAMPTZ(6)  NOT NULL,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id"          UUID            NOT NULL,
    "user_id"     UUID            NOT NULL,
    "token_hash"  TEXT            NOT NULL,
    "expires_at"  TIMESTAMPTZ(6)  NOT NULL,
    "used_at"     TIMESTAMPTZ(6),
    "created_at"  TIMESTAMPTZ(6)  NOT NULL,
    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
