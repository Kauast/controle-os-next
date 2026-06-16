-- Migration: hash_refresh_tokens
-- Decisão: DELETE + rename/add column (opção mais simples e segura).
-- Justificativa: não é possível recuperar o token cru de linhas existentes para gerar o SHA-256.
-- Backfill via pgcrypto seria necessário mas adicionaria uma dependência de extensão desnecessária.
-- Como os refresh tokens são efêmeros (TTL 7 dias) e o sistema está em pré-produção, forçar
-- re-login de todos os usuários é aceitável e elimina qualquer risco de dados legados em texto puro.

-- 1. Apaga todos os refresh tokens existentes (armazenados em texto puro)
DELETE FROM "RefreshToken";

-- 2. Remove os índices e constraint unique antigos que referenciam a coluna "token"
DROP INDEX IF EXISTS "RefreshToken_token_key";
DROP INDEX IF EXISTS "RefreshToken_token_idx";

-- 3. Renomeia a coluna "token" para "tokenHash"
ALTER TABLE "RefreshToken" RENAME COLUMN "token" TO "tokenHash";

-- 4. Recria unique index e índice de busca sobre a nova coluna
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");
