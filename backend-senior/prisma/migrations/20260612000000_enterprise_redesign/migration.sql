-- ============================================================
-- FASE 1: Remover dependências FK antes de qualquer alteração
-- ============================================================

ALTER TABLE "ServiceOrder" DROP CONSTRAINT IF EXISTS "ServiceOrder_clientId_fkey";
ALTER TABLE "ServiceOrder" DROP CONSTRAINT IF EXISTS "ServiceOrder_technicianId_fkey";
ALTER TABLE "OSItem" DROP CONSTRAINT IF EXISTS "OSItem_serviceOrderId_fkey";
ALTER TABLE "OSItem" DROP CONSTRAINT IF EXISTS "OSItem_productId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_serviceOrderId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_clientId_fkey";
ALTER TABLE "StockMovement" DROP CONSTRAINT IF EXISTS "StockMovement_productId_fkey";
ALTER TABLE "StockMovement" DROP CONSTRAINT IF EXISTS "StockMovement_serviceOrderId_fkey";
ALTER TABLE "MaterialRequest" DROP CONSTRAINT IF EXISTS "MaterialRequest_serviceOrderId_fkey";
ALTER TABLE "MaterialRequest" DROP CONSTRAINT IF EXISTS "MaterialRequest_productId_fkey";
ALTER TABLE "Chip" DROP CONSTRAINT IF EXISTS "Chip_clientId_fkey";
ALTER TABLE "Chip" DROP CONSTRAINT IF EXISTS "Chip_serviceOrderId_fkey";
ALTER TABLE "RefreshToken" DROP CONSTRAINT IF EXISTS "RefreshToken_userId_fkey";
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT IF EXISTS "PasswordResetToken_userId_fkey";
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE "Technician" DROP CONSTRAINT IF EXISTS "Technician_userId_fkey";

-- ============================================================
-- FASE 2: Novos ENUMs
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "PlanType" AS ENUM ('BASIC', 'PROFESSIONAL', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TechnicianStatus" AS ENUM ('AVAILABLE', 'BUSY', 'OFF', 'VACATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'BOLETO', 'CHECK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FinancialMovementType" AS ENUM ('INCOME', 'EXPENSE', 'REFUND', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Adicionar novos valores em ENUMs existentes
DO $$ BEGIN
  ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'TRANSFER';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'LOSS';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'RETURN';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "Priority" ADD VALUE IF NOT EXISTS 'CRITICAL';
EXCEPTION WHEN others THEN NULL; END $$;

-- Renomear Status → OrderStatus (preserva dados)
DO $$ BEGIN
  ALTER TYPE "Status" RENAME TO "OrderStatus";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- ============================================================
-- FASE 3: Criar tabela Company (Tenant)
-- ============================================================

CREATE TABLE IF NOT EXISTS "Company" (
    "id"        TEXT        NOT NULL,
    "name"      TEXT        NOT NULL,
    "document"  TEXT        NOT NULL,
    "plan"      "PlanType"  NOT NULL DEFAULT 'BASIC',
    "active"    BOOLEAN     NOT NULL DEFAULT true,
    "maxUsers"  INTEGER     NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Company_document_key" ON "Company"("document");

-- Inserir empresa padrão para dados existentes
INSERT INTO "Company" ("id", "name", "document", "plan", "active", "updatedAt")
VALUES ('default-company-id', 'Empresa Padrão', '00000000000000', 'ENTERPRISE', true, NOW())
ON CONFLICT ("document") DO NOTHING;

-- ============================================================
-- FASE 4: Adicionar companyId + campos aux em tabelas existentes
-- ============================================================

-- User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "companyId"         TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "deletedAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedBy"         TEXT;

UPDATE "User" SET "companyId" = 'default-company-id' WHERE "companyId" IS NULL;
ALTER TABLE "User" ALTER COLUMN "companyId" SET NOT NULL;

-- Remover unique em email (agora é unique por company)
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";

-- Client
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "version"   INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

UPDATE "Client" SET "companyId" = 'default-company-id' WHERE "companyId" IS NULL;
ALTER TABLE "Client" ALTER COLUMN "companyId" SET NOT NULL;

-- Mover unique de document para (companyId, document)
ALTER TABLE "Client" DROP CONSTRAINT IF EXISTS "Client_document_key";

-- Technician
ALTER TABLE "Technician"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "status"    "TechnicianStatus" NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN IF NOT EXISTS "version"   INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

UPDATE "Technician" SET "companyId" = 'default-company-id' WHERE "companyId" IS NULL;
ALTER TABLE "Technician" ALTER COLUMN "companyId" SET NOT NULL;

-- ServiceOrder
ALTER TABLE "ServiceOrder"
  ADD COLUMN IF NOT EXISTS "companyId"     TEXT,
  ADD COLUMN IF NOT EXISTS "teamId"        TEXT,
  ADD COLUMN IF NOT EXISTS "internalNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "chipIccid"     TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedBy"     TEXT;

-- Migrar chipId (ICCID) para chipIccid
UPDATE "ServiceOrder" SET "chipIccid" = "chipId" WHERE "chipId" IS NOT NULL AND "chipIccid" IS NULL;

UPDATE "ServiceOrder" SET "companyId" = 'default-company-id' WHERE "companyId" IS NULL;
ALTER TABLE "ServiceOrder" ALTER COLUMN "companyId" SET NOT NULL;

-- Remover unique global no number (será (companyId, number))
ALTER TABLE "ServiceOrder" DROP CONSTRAINT IF EXISTS "ServiceOrder_number_key";

-- Product
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "companyId"  TEXT,
  ADD COLUMN IF NOT EXISTS "categoryId" TEXT,
  ADD COLUMN IF NOT EXISTS "version"    INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "deletedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedBy"  TEXT;

UPDATE "Product" SET "companyId" = 'default-company-id' WHERE "companyId" IS NULL;
ALTER TABLE "Product" ALTER COLUMN "companyId" SET NOT NULL;

-- Remover unique global em sku (será (companyId, sku))
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_sku_key";

-- StockMovement
ALTER TABLE "StockMovement"
  ADD COLUMN IF NOT EXISTS "companyId"     TEXT,
  ADD COLUMN IF NOT EXISTS "balanceBefore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "balanceAfter"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "unitCost"      DECIMAL(10,2);

UPDATE "StockMovement" SET "companyId" = 'default-company-id' WHERE "companyId" IS NULL;
ALTER TABLE "StockMovement" ALTER COLUMN "companyId" SET NOT NULL;

-- Payment (substituição do modelo legado)
ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "companyId"      TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceId"      TEXT,
  ADD COLUMN IF NOT EXISTS "method"         "PaymentMethod" NOT NULL DEFAULT 'CASH',
  ADD COLUMN IF NOT EXISTS "discount"       DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "interest"       DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fine"           DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "netAmount"      DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "installmentOf"  INTEGER,
  ADD COLUMN IF NOT EXISTS "installmentNum" INTEGER,
  ADD COLUMN IF NOT EXISTS "cancelledAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledBy"    TEXT,
  ADD COLUMN IF NOT EXISTS "cancelReason"   TEXT,
  ADD COLUMN IF NOT EXISTS "notes"          TEXT,
  ADD COLUMN IF NOT EXISTS "version"        INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Payment" SET "companyId" = 'default-company-id', "netAmount" = "amount" WHERE "companyId" IS NULL;
ALTER TABLE "Payment" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "netAmount" SET NOT NULL;

-- Chip
ALTER TABLE "Chip"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "version"   INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

UPDATE "Chip" SET "companyId" = 'default-company-id' WHERE "companyId" IS NULL;
ALTER TABLE "Chip" ALTER COLUMN "companyId" SET NOT NULL;

-- Remover unique global no iccid (será (companyId, iccid))
ALTER TABLE "Chip" DROP CONSTRAINT IF EXISTS "Chip_iccid_key";

-- AuditLog
ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "entity"    TEXT,
  ADD COLUMN IF NOT EXISTS "entityId"  TEXT,
  ADD COLUMN IF NOT EXISTS "before"    JSONB,
  ADD COLUMN IF NOT EXISTS "after"     JSONB,
  ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

-- MaterialRequest
ALTER TABLE "MaterialRequest"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ============================================================
-- FASE 5: Renomear OSItem → ServiceOrderItem
-- ============================================================

ALTER TABLE "OSItem" RENAME TO "ServiceOrderItem";

ALTER TABLE "ServiceOrderItem"
  ADD COLUMN IF NOT EXISTS "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total"    DECIMAL(10,2);

UPDATE "ServiceOrderItem"
SET "total" = ("quantity" * "unitPrice") - COALESCE("discount", 0)
WHERE "total" IS NULL;

ALTER TABLE "ServiceOrderItem" ALTER COLUMN "total" SET NOT NULL;

-- ============================================================
-- FASE 6: Criar novas tabelas
-- ============================================================

-- Team
CREATE TABLE IF NOT EXISTS "Team" (
    "id"        TEXT        NOT NULL,
    "companyId" TEXT        NOT NULL,
    "name"      TEXT        NOT NULL,
    "active"    BOOLEAN     NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TeamMember" (
    "id"           TEXT     NOT NULL,
    "teamId"       TEXT     NOT NULL,
    "technicianId" TEXT     NOT NULL,
    "isLeader"     BOOLEAN  NOT NULL DEFAULT false,
    "joinedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- Migrar ServiceOrder.team (text) → Team entities
INSERT INTO "Team" ("id", "companyId", "name", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'default-company-id',
  "team",
  NOW()
FROM (
  SELECT DISTINCT "team"
  FROM "ServiceOrder"
  WHERE "team" IS NOT NULL AND "team" != '' AND "team" != 'Sem equipe'
) AS distinct_teams
ON CONFLICT DO NOTHING;

-- Vincular ServiceOrder ao Team recém-criado
UPDATE "ServiceOrder" so
SET "teamId" = t."id"
FROM "Team" t
WHERE t."companyId" = 'default-company-id'
  AND t."name" = so."team"
  AND so."teamId" IS NULL;

-- ProductCategory
CREATE TABLE IF NOT EXISTS "ProductCategory" (
    "id"        TEXT     NOT NULL,
    "companyId" TEXT     NOT NULL,
    "name"      TEXT     NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- Migrar Product.category (text) → ProductCategory entities
INSERT INTO "ProductCategory" ("id", "companyId", "name", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'default-company-id',
  "category",
  NOW()
FROM (
  SELECT DISTINCT "category"
  FROM "Product"
  WHERE "category" IS NOT NULL AND "category" != ''
) AS distinct_cats
ON CONFLICT DO NOTHING;

-- Vincular Product ao ProductCategory
UPDATE "Product" p
SET "categoryId" = pc."id"
FROM "ProductCategory" pc
WHERE pc."companyId" = 'default-company-id'
  AND pc."name" = p."category"
  AND p."categoryId" IS NULL;

-- StockReservation
CREATE TABLE IF NOT EXISTS "StockReservation" (
    "id"             TEXT     NOT NULL,
    "companyId"      TEXT     NOT NULL,
    "productId"      TEXT     NOT NULL,
    "serviceOrderId" TEXT     NOT NULL,
    "quantity"       INTEGER  NOT NULL,
    "status"         "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt"     TIMESTAMP(3),
    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- ServiceOrderSchedule
CREATE TABLE IF NOT EXISTS "ServiceOrderSchedule" (
    "id"             TEXT     NOT NULL,
    "serviceOrderId" TEXT     NOT NULL,
    "scheduledDate"  TIMESTAMP(3) NOT NULL,
    "scheduledTime"  TEXT,
    "estimatedHours" DECIMAL(4,2),
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceOrderSchedule_pkey" PRIMARY KEY ("id")
);

-- Migrar scheduledTime de ServiceOrder → ServiceOrderSchedule
INSERT INTO "ServiceOrderSchedule" ("id", "serviceOrderId", "scheduledDate", "scheduledTime", "updatedAt")
SELECT
  gen_random_uuid()::text,
  "id",
  "dueDate",
  "scheduledTime",
  NOW()
FROM "ServiceOrder"
WHERE "scheduledTime" IS NOT NULL;

-- ServiceOrderExecution
CREATE TABLE IF NOT EXISTS "ServiceOrderExecution" (
    "id"              TEXT     NOT NULL,
    "serviceOrderId"  TEXT     NOT NULL,
    "checkinAt"       TIMESTAMP(3),
    "checkoutAt"      TIMESTAMP(3),
    "checkinLocation" TEXT,
    "checkinLat"      DECIMAL(10,7),
    "checkinLng"      DECIMAL(10,7),
    "checkoutLat"     DECIMAL(10,7),
    "checkoutLng"     DECIMAL(10,7),
    "workDoneNotes"   TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceOrderExecution_pkey" PRIMARY KEY ("id")
);

-- Migrar dados de execução de ServiceOrder → ServiceOrderExecution
INSERT INTO "ServiceOrderExecution" ("id", "serviceOrderId", "checkinAt", "checkoutAt", "checkinLocation", "updatedAt")
SELECT
  gen_random_uuid()::text,
  "id",
  "checkinAt",
  "checkoutAt",
  "checkinLocation",
  NOW()
FROM "ServiceOrder"
WHERE "checkinAt" IS NOT NULL OR "checkoutAt" IS NOT NULL;

-- ServiceOrderHistory
CREATE TABLE IF NOT EXISTS "ServiceOrderHistory" (
    "id"             TEXT     NOT NULL,
    "serviceOrderId" TEXT     NOT NULL,
    "userId"         TEXT,
    "action"         TEXT     NOT NULL,
    "fromStatus"     "OrderStatus",
    "toStatus"       "OrderStatus",
    "note"           TEXT,
    "before"         JSONB,
    "after"          JSONB,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceOrderHistory_pkey" PRIMARY KEY ("id")
);

-- ServiceOrderEvent
CREATE TABLE IF NOT EXISTS "ServiceOrderEvent" (
    "id"             TEXT     NOT NULL,
    "serviceOrderId" TEXT     NOT NULL,
    "eventType"      TEXT     NOT NULL,
    "description"    TEXT     NOT NULL,
    "userId"         TEXT,
    "metadata"       JSONB,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceOrderEvent_pkey" PRIMARY KEY ("id")
);

-- Attachment
CREATE TABLE IF NOT EXISTS "Attachment" (
    "id"              TEXT     NOT NULL,
    "companyId"       TEXT     NOT NULL,
    "entityType"      TEXT     NOT NULL,
    "entityId"        TEXT     NOT NULL,
    "serviceOrderId"  TEXT,
    "fileName"        TEXT     NOT NULL,
    "originalName"    TEXT     NOT NULL,
    "mimeType"        TEXT     NOT NULL,
    "fileSize"        INTEGER  NOT NULL,
    "storageProvider" TEXT     NOT NULL DEFAULT 'local',
    "storagePath"     TEXT     NOT NULL,
    "hash"            TEXT,
    "uploadedBy"      TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- Migrar photoUrls de ServiceOrder → Attachment
INSERT INTO "Attachment" ("id", "companyId", "entityType", "entityId", "serviceOrderId", "fileName", "originalName", "mimeType", "fileSize", "storagePath")
SELECT
  gen_random_uuid()::text,
  'default-company-id',
  'SERVICE_ORDER',
  so."id",
  so."id",
  regexp_replace(url, '^.+/([^/]+)$', '\1'),
  regexp_replace(url, '^.+/([^/]+)$', '\1'),
  'image/jpeg',
  0,
  url
FROM "ServiceOrder" so,
  UNNEST(so."photoUrls") AS url
WHERE array_length(so."photoUrls", 1) > 0;

-- Migrar clientSignature de ServiceOrder → Attachment
INSERT INTO "Attachment" ("id", "companyId", "entityType", "entityId", "serviceOrderId", "fileName", "originalName", "mimeType", "fileSize", "storagePath")
SELECT
  gen_random_uuid()::text,
  'default-company-id',
  'SERVICE_ORDER_SIGNATURE',
  "id",
  "id",
  'client_signature.png',
  'client_signature.png',
  'image/png',
  0,
  "clientSignature"
FROM "ServiceOrder"
WHERE "clientSignature" IS NOT NULL AND "clientSignature" != '';

-- Invoice
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id"             TEXT         NOT NULL,
    "companyId"      TEXT         NOT NULL,
    "number"         INTEGER      NOT NULL,
    "clientId"       TEXT         NOT NULL,
    "serviceOrderId" TEXT,
    "status"         "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal"       DECIMAL(10,2) NOT NULL,
    "discount"       DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax"            DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total"          DECIMAL(10,2) NOT NULL,
    "dueDate"        TIMESTAMP(3) NOT NULL,
    "notes"          TEXT,
    "version"        INTEGER      NOT NULL DEFAULT 1,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"      TIMESTAMP(3),
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- Criar Invoice para cada Payment existente (retroativo)
INSERT INTO "Invoice" ("id", "companyId", "number", "clientId", "serviceOrderId", "status", "subtotal", "total", "dueDate", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'default-company-id',
  ROW_NUMBER() OVER (ORDER BY p."createdAt"),
  p."clientId",
  p."serviceOrderId",
  CASE p."status"
    WHEN 'PAID' THEN 'PAID'::"InvoiceStatus"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"InvoiceStatus"
    WHEN 'OVERDUE' THEN 'OVERDUE'::"InvoiceStatus"
    ELSE 'ISSUED'::"InvoiceStatus"
  END,
  p."amount",
  p."amount",
  p."dueDate",
  NOW()
FROM "Payment" p;

-- Vincular Payment ao Invoice criado
WITH invoice_payment AS (
  SELECT
    i."id" AS invoice_id,
    p."id" AS payment_id
  FROM "Invoice" i
  JOIN "Payment" p ON p."serviceOrderId" = i."serviceOrderId"
    AND p."clientId" = i."clientId"
  WHERE i."companyId" = 'default-company-id'
)
UPDATE "Payment" p
SET "invoiceId" = ip.invoice_id
FROM invoice_payment ip
WHERE p."id" = ip.payment_id
  AND p."invoiceId" IS NULL;

-- Fallback: vincular payments sem invoice
UPDATE "Payment" p
SET "invoiceId" = (
  SELECT i."id" FROM "Invoice" i
  WHERE i."clientId" = p."clientId"
  LIMIT 1
)
WHERE p."invoiceId" IS NULL;

ALTER TABLE "Payment" ALTER COLUMN "invoiceId" SET NOT NULL;

-- ChipHistory
CREATE TABLE IF NOT EXISTS "ChipHistory" (
    "id"             TEXT     NOT NULL,
    "chipId"         TEXT     NOT NULL,
    "fromClientId"   TEXT,
    "toClientId"     TEXT,
    "serviceOrderId" TEXT,
    "action"         TEXT     NOT NULL,
    "notes"          TEXT,
    "userId"         TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChipHistory_pkey" PRIMARY KEY ("id")
);

-- FinancialMovement
CREATE TABLE IF NOT EXISTS "FinancialMovement" (
    "id"           TEXT     NOT NULL,
    "companyId"    TEXT     NOT NULL,
    "type"         "FinancialMovementType" NOT NULL,
    "category"     TEXT     NOT NULL,
    "description"  TEXT     NOT NULL,
    "amount"       DECIMAL(10,2) NOT NULL,
    "paymentId"    TEXT,
    "invoiceId"    TEXT,
    "userId"       TEXT,
    "reference"    TEXT,
    "notes"        TEXT,
    "movementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialMovement_pkey" PRIMARY KEY ("id")
);

-- Criar FinancialMovement para pagamentos existentes
INSERT INTO "FinancialMovement" ("id", "companyId", "type", "category", "description", "amount", "paymentId", "invoiceId")
SELECT
  gen_random_uuid()::text,
  'default-company-id',
  'INCOME'::"FinancialMovementType",
  'SERVICO',
  'Pagamento de OS',
  p."amount",
  p."id",
  p."invoiceId"
FROM "Payment" p
WHERE p."status" = 'PAID';

-- ============================================================
-- FASE 7: Unique Constraints
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS "Company_document_key"   ON "Company"("document");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_company_key" ON "User"("email", "companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "Client_company_doc_key" ON "Client"("companyId", "document");
CREATE UNIQUE INDEX IF NOT EXISTS "Product_company_sku_key" ON "Product"("companyId", "sku");
CREATE UNIQUE INDEX IF NOT EXISTS "Chip_company_iccid_key"  ON "Chip"("companyId", "iccid");
CREATE UNIQUE INDEX IF NOT EXISTS "SO_company_number_key"   ON "ServiceOrder"("companyId", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_company_num_key" ON "Invoice"("companyId", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "Team_company_name_key"   ON "Team"("companyId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_unique"       ON "TeamMember"("teamId", "technicianId");
CREATE UNIQUE INDEX IF NOT EXISTS "SOSchedule_os_key"       ON "ServiceOrderSchedule"("serviceOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "SOExecution_os_key"      ON "ServiceOrderExecution"("serviceOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductCategory_name_key" ON "ProductCategory"("companyId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "Technician_userId_key"   ON "Technician"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_token_key"  ON "RefreshToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tok"  ON "PasswordResetToken"("token");

-- ============================================================
-- FASE 8: Índices de performance
-- ============================================================

-- ServiceOrder
CREATE INDEX IF NOT EXISTS "idx_so_company_status_date"     ON "ServiceOrder"("companyId", "status", "openingDate");
CREATE INDEX IF NOT EXISTS "idx_so_company_client_status"   ON "ServiceOrder"("companyId", "clientId", "status");
CREATE INDEX IF NOT EXISTS "idx_so_company_tech_status"     ON "ServiceOrder"("companyId", "technicianId", "status");
CREATE INDEX IF NOT EXISTS "idx_so_company_team_status"     ON "ServiceOrder"("companyId", "teamId", "status");
CREATE INDEX IF NOT EXISTS "idx_so_company_priority_date"   ON "ServiceOrder"("companyId", "priority", "openingDate");
CREATE INDEX IF NOT EXISTS "idx_so_deletedat"               ON "ServiceOrder"("deletedAt");

-- Product
CREATE INDEX IF NOT EXISTS "idx_product_company_cat"        ON "Product"("companyId", "categoryId");
CREATE INDEX IF NOT EXISTS "idx_product_sku"                ON "Product"("sku");
CREATE INDEX IF NOT EXISTS "idx_product_deletedat"          ON "Product"("deletedAt");

-- Client
CREATE INDEX IF NOT EXISTS "idx_client_company"             ON "Client"("companyId");
CREATE INDEX IF NOT EXISTS "idx_client_document"            ON "Client"("document");
CREATE INDEX IF NOT EXISTS "idx_client_deletedat"           ON "Client"("deletedAt");

-- Payment
CREATE INDEX IF NOT EXISTS "idx_payment_company_status_due" ON "Payment"("companyId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "idx_payment_company_client"     ON "Payment"("companyId", "clientId");
CREATE INDEX IF NOT EXISTS "idx_payment_invoice"            ON "Payment"("invoiceId");

-- Invoice
CREATE INDEX IF NOT EXISTS "idx_invoice_company_status_due" ON "Invoice"("companyId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "idx_invoice_company_client"     ON "Invoice"("companyId", "clientId");

-- StockMovement
CREATE INDEX IF NOT EXISTS "idx_sm_company_product"         ON "StockMovement"("companyId", "productId");
CREATE INDEX IF NOT EXISTS "idx_sm_product_date"            ON "StockMovement"("productId", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_sm_serviceorder"            ON "StockMovement"("serviceOrderId");

-- StockReservation
CREATE INDEX IF NOT EXISTS "idx_sr_product_status"          ON "StockReservation"("productId", "status");
CREATE INDEX IF NOT EXISTS "idx_sr_serviceorder"            ON "StockReservation"("serviceOrderId");

-- AuditLog
CREATE INDEX IF NOT EXISTS "idx_audit_company_date"         ON "AuditLog"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_audit_entity"               ON "AuditLog"("entity", "entityId");
CREATE INDEX IF NOT EXISTS "idx_audit_user"                 ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "idx_audit_date"                 ON "AuditLog"("createdAt");

-- Technician
CREATE INDEX IF NOT EXISTS "idx_technician_company"         ON "Technician"("companyId");
CREATE INDEX IF NOT EXISTS "idx_technician_company_active"  ON "Technician"("companyId", "isActive");

-- RefreshToken
CREATE INDEX IF NOT EXISTS "idx_refresh_userid"             ON "RefreshToken"("userId");
CREATE INDEX IF NOT EXISTS "idx_refresh_token"              ON "RefreshToken"("token");

-- Attachment
CREATE INDEX IF NOT EXISTS "idx_attachment_entity"          ON "Attachment"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "idx_attachment_company"         ON "Attachment"("companyId");

-- ServiceOrderHistory
CREATE INDEX IF NOT EXISTS "idx_soh_os_date"                ON "ServiceOrderHistory"("serviceOrderId", "createdAt");

-- ServiceOrderEvent
CREATE INDEX IF NOT EXISTS "idx_soe_os"                     ON "ServiceOrderEvent"("serviceOrderId");

-- Chip
CREATE INDEX IF NOT EXISTS "idx_chip_company_client"        ON "Chip"("companyId", "clientId");
CREATE INDEX IF NOT EXISTS "idx_chip_company_status"        ON "Chip"("companyId", "status");

-- ChipHistory
CREATE INDEX IF NOT EXISTS "idx_chiphistory_chip"           ON "ChipHistory"("chipId");

-- FinancialMovement
CREATE INDEX IF NOT EXISTS "idx_fm_company_type_date"       ON "FinancialMovement"("companyId", "type", "movementDate");
CREATE INDEX IF NOT EXISTS "idx_fm_company_cat"             ON "FinancialMovement"("companyId", "category");

-- ============================================================
-- FASE 9: Foreign Keys
-- ============================================================

-- User
ALTER TABLE "User"
  ADD CONSTRAINT "User_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RefreshToken
ALTER TABLE "RefreshToken"
  ADD CONSTRAINT "RefreshToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PasswordResetToken
ALTER TABLE "PasswordResetToken"
  ADD CONSTRAINT "PasswordResetToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AuditLog
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Team
ALTER TABLE "Team"
  ADD CONSTRAINT "Team_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- TeamMember
ALTER TABLE "TeamMember"
  ADD CONSTRAINT "TeamMember_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember"
  ADD CONSTRAINT "TeamMember_technicianId_fkey"
    FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Technician
ALTER TABLE "Technician"
  ADD CONSTRAINT "Technician_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Client
ALTER TABLE "Client"
  ADD CONSTRAINT "Client_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ProductCategory
ALTER TABLE "ProductCategory"
  ADD CONSTRAINT "ProductCategory_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Product
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ServiceOrder
ALTER TABLE "ServiceOrder"
  ADD CONSTRAINT "ServiceOrder_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder"
  ADD CONSTRAINT "ServiceOrder_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder"
  ADD CONSTRAINT "ServiceOrder_technicianId_fkey"
    FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder"
  ADD CONSTRAINT "ServiceOrder_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ServiceOrderItem
ALTER TABLE "ServiceOrderItem"
  ADD CONSTRAINT "ServiceOrderItem_serviceOrderId_fkey"
    FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceOrderItem"
  ADD CONSTRAINT "ServiceOrderItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ServiceOrderSchedule
ALTER TABLE "ServiceOrderSchedule"
  ADD CONSTRAINT "ServiceOrderSchedule_serviceOrderId_fkey"
    FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ServiceOrderExecution
ALTER TABLE "ServiceOrderExecution"
  ADD CONSTRAINT "ServiceOrderExecution_serviceOrderId_fkey"
    FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ServiceOrderHistory
ALTER TABLE "ServiceOrderHistory"
  ADD CONSTRAINT "ServiceOrderHistory_serviceOrderId_fkey"
    FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ServiceOrderEvent
ALTER TABLE "ServiceOrderEvent"
  ADD CONSTRAINT "ServiceOrderEvent_serviceOrderId_fkey"
    FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Attachment
ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_serviceOrderId_fkey"
    FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- StockMovement
ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_serviceOrderId_fkey"
    FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- StockReservation
ALTER TABLE "StockReservation"
  ADD CONSTRAINT "StockReservation_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReservation"
  ADD CONSTRAINT "StockReservation_serviceOrderId_fkey"
    FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- MaterialRequest
ALTER TABLE "MaterialRequest"
  ADD CONSTRAINT "MaterialRequest_serviceOrderId_fkey"
    FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialRequest"
  ADD CONSTRAINT "MaterialRequest_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Chip
ALTER TABLE "Chip"
  ADD CONSTRAINT "Chip_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Chip"
  ADD CONSTRAINT "Chip_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Chip"
  ADD CONSTRAINT "Chip_serviceOrderId_fkey"
    FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ChipHistory
ALTER TABLE "ChipHistory"
  ADD CONSTRAINT "ChipHistory_chipId_fkey"
    FOREIGN KEY ("chipId") REFERENCES "Chip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invoice
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_serviceOrderId_fkey"
    FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Payment
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FinancialMovement
ALTER TABLE "FinancialMovement"
  ADD CONSTRAINT "FinancialMovement_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialMovement"
  ADD CONSTRAINT "FinancialMovement_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- FASE 10: Remover colunas obsoletas (após migração de dados)
-- ============================================================

ALTER TABLE "ServiceOrder"
  DROP COLUMN IF EXISTS "team",
  DROP COLUMN IF EXISTS "scheduledTime",
  DROP COLUMN IF EXISTS "photoUrls",
  DROP COLUMN IF EXISTS "clientSignature",
  DROP COLUMN IF EXISTS "checkinAt",
  DROP COLUMN IF EXISTS "checkoutAt",
  DROP COLUMN IF EXISTS "checkinLocation",
  DROP COLUMN IF EXISTS "chipId";

ALTER TABLE "Product"
  DROP COLUMN IF EXISTS "category",
  DROP COLUMN IF EXISTS "stockQuantity";
