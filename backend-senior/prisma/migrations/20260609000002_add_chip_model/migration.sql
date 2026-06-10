-- Remover coluna antiga chipIds do Client
ALTER TABLE "Client" DROP COLUMN IF EXISTS "chipIds";

-- Criar enum ChipStatus
CREATE TYPE "ChipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- Criar tabela Chip
CREATE TABLE "Chip" (
  "id"             TEXT NOT NULL,
  "iccid"          TEXT NOT NULL,
  "phoneNumber"    TEXT,
  "operator"       TEXT,
  "model"          TEXT,
  "status"         "ChipStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes"          TEXT,
  "clientId"       TEXT,
  "serviceOrderId" TEXT,
  "installedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Chip_pkey" PRIMARY KEY ("id")
);

-- Índice único no ICCID
CREATE UNIQUE INDEX "Chip_iccid_key" ON "Chip"("iccid");

-- Índices para FK
CREATE INDEX "Chip_clientId_idx" ON "Chip"("clientId");
CREATE INDEX "Chip_serviceOrderId_idx" ON "Chip"("serviceOrderId");

-- FKs
ALTER TABLE "Chip"
  ADD CONSTRAINT "Chip_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Chip"
  ADD CONSTRAINT "Chip_serviceOrderId_fkey"
    FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
