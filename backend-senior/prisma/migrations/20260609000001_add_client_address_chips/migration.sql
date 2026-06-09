-- AlterTable: Client — novos campos de endereço, responsável e chips
ALTER TABLE "Client"
  ADD COLUMN "address"      TEXT,
  ADD COLUMN "neighborhood" TEXT,
  ADD COLUMN "city"         TEXT,
  ADD COLUMN "state"        TEXT,
  ADD COLUMN "contactName"  TEXT,
  ADD COLUMN "chipIds"      TEXT[] NOT NULL DEFAULT '{}';

-- Relaxar validação: documento pode ser código interno curto (min 3 chars)
-- Nenhuma alteração no banco necessária — só no schema Zod
