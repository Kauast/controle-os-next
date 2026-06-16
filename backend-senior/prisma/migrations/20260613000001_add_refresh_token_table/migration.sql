-- Migration: add_refresh_token_table
-- Cria a tabela RefreshToken que estava referenciada em FKs da migration enterprise_redesign
-- mas não havia sido criada explicitamente em nenhuma migration anterior.

CREATE TABLE IF NOT EXISTS "RefreshToken" (
    "id"        TEXT        NOT NULL,
    "token"     TEXT        NOT NULL,
    "userId"    TEXT        NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_token_key" ON "RefreshToken"("token");
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx"  ON "RefreshToken"("userId");
CREATE INDEX IF NOT EXISTS "RefreshToken_token_idx"   ON "RefreshToken"("token");

ALTER TABLE "RefreshToken" DROP CONSTRAINT IF EXISTS "RefreshToken_userId_fkey";
ALTER TABLE "RefreshToken"
    ADD CONSTRAINT "RefreshToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
