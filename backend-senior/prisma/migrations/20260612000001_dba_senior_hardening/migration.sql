-- DBA Senior Hardening — 2026-06-12

ALTER TABLE "ServiceOrder"
  ADD COLUMN IF NOT EXISTS "scheduledStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "scheduledEnd"   TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ServiceOrder_dueDate_idx"        ON "ServiceOrder"("dueDate");
CREATE INDEX IF NOT EXISTS "ServiceOrder_createdAt_idx"      ON "ServiceOrder"("createdAt");
CREATE INDEX IF NOT EXISTS "ServiceOrder_scheduledStart_idx" ON "ServiceOrder"("scheduledStart");
CREATE INDEX IF NOT EXISTS "ServiceOrder_scheduledEnd_idx"   ON "ServiceOrder"("scheduledEnd");

CREATE INDEX IF NOT EXISTS "Product_name_idx"     ON "Product"("name");
CREATE INDEX IF NOT EXISTS "Product_minStock_idx" ON "Product"("minStock");

CREATE INDEX IF NOT EXISTS "StockMovement_userId_idx"         ON "StockMovement"("userId");
CREATE INDEX IF NOT EXISTS "StockMovement_type_createdAt_idx" ON "StockMovement"("type", "createdAt");

CREATE INDEX IF NOT EXISTS "Client_name_idx"      ON "Client"("name");
CREATE INDEX IF NOT EXISTS "Client_phone_idx"     ON "Client"("phone");
CREATE INDEX IF NOT EXISTS "Client_city_idx"      ON "Client"("city");
CREATE INDEX IF NOT EXISTS "Client_isBlocked_idx" ON "Client"("isBlocked");

CREATE INDEX IF NOT EXISTS "Chip_serviceOrderId_idx" ON "Chip"("serviceOrderId");
CREATE INDEX IF NOT EXISTS "Chip_installedAt_idx"    ON "Chip"("installedAt");

CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "reference"   TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT;

CREATE INDEX IF NOT EXISTS "Payment_status_idx"  ON "Payment"("status");
CREATE INDEX IF NOT EXISTS "Payment_dueDate_idx" ON "Payment"("dueDate");
CREATE INDEX IF NOT EXISTS "Payment_paidAt_idx"  ON "Payment"("paidAt");

ALTER TYPE "FinancialMovementType" ADD VALUE IF NOT EXISTS 'REVERSAL';

ALTER TABLE "Attachment"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

CREATE INDEX IF NOT EXISTS "Attachment_uploadedBy_idx" ON "Attachment"("uploadedBy");
CREATE INDEX IF NOT EXISTS "Attachment_createdAt_idx"  ON "Attachment"("createdAt");
