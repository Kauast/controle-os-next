-- Missing FK indexes and partial indexes — 2026-06-16

-- PasswordResetToken: userId FK had no index
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- TeamMember: technicianId FK had no standalone index (only part of unique)
CREATE INDEX IF NOT EXISTS "TeamMember_technicianId_idx" ON "TeamMember"("technicianId");

-- MaterialRequest: had zero indexes
CREATE INDEX IF NOT EXISTS "MaterialRequest_serviceOrderId_idx" ON "MaterialRequest"("serviceOrderId");
CREATE INDEX IF NOT EXISTS "MaterialRequest_productId_idx" ON "MaterialRequest"("productId");
CREATE INDEX IF NOT EXISTS "MaterialRequest_status_idx" ON "MaterialRequest"("status");

-- ChipHistory: secondary FK columns had no indexes
CREATE INDEX IF NOT EXISTS "ChipHistory_serviceOrderId_idx" ON "ChipHistory"("serviceOrderId");
CREATE INDEX IF NOT EXISTS "ChipHistory_userId_idx" ON "ChipHistory"("userId");

-- Attachment: serviceOrderId FK had no dedicated index
CREATE INDEX IF NOT EXISTS "Attachment_serviceOrderId_idx" ON "Attachment"("serviceOrderId");

-- StockMovement: compound tenant+time range index
CREATE INDEX IF NOT EXISTS "StockMovement_companyId_createdAt_idx" ON "StockMovement"("companyId", "createdAt");

-- FinancialMovement: FK columns had no indexes
CREATE INDEX IF NOT EXISTS "FinancialMovement_paymentId_idx" ON "FinancialMovement"("paymentId");
CREATE INDEX IF NOT EXISTS "FinancialMovement_invoiceId_idx" ON "FinancialMovement"("invoiceId");

-- Partial indexes for soft-delete pattern (WHERE deletedAt IS NULL)
-- These dramatically speed up all normal queries that exclude deleted rows
CREATE INDEX IF NOT EXISTS "ServiceOrder_active_status_openingDate_idx"
  ON "ServiceOrder"("companyId", "status", "openingDate")
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Client_active_companyId_idx"
  ON "Client"("companyId")
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Technician_active_companyId_idx"
  ON "Technician"("companyId", "isActive")
  WHERE "deletedAt" IS NULL AND "isActive" = true;

-- Partial index for the most common StockReservation query (ACTIVE reservations)
CREATE INDEX IF NOT EXISTS "StockReservation_active_product_idx"
  ON "StockReservation"("productId", "companyId")
  WHERE "status" = 'ACTIVE';

-- Add companyId to MaterialRequest for direct tenant scoping
ALTER TABLE "MaterialRequest" ADD COLUMN IF NOT EXISTS "companyId" TEXT NOT NULL DEFAULT '';

-- Back-fill companyId from the linked ServiceOrder (for existing data)
UPDATE "MaterialRequest" mr
SET "companyId" = so."companyId"
FROM "ServiceOrder" so
WHERE mr."serviceOrderId" = so.id
  AND mr."companyId" = '';

CREATE INDEX IF NOT EXISTS "MaterialRequest_companyId_status_idx" ON "MaterialRequest"("companyId", "status");

-- Attachment.fileSize: Int → BigInt to support files > 2GB
ALTER TABLE "Attachment" ALTER COLUMN "fileSize" TYPE BIGINT;
