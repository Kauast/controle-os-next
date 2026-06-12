-- DBA Senior Hardening — 2026-06-12
-- Fase 2: Índices compostos e simples para performance
-- Fase 7: Campos de agendamento com DateTime nativo
-- Fase 8: Soft delete em Attachment
-- Fase 9: Campos financeiros + enum REVERSAL
-- Pré-existente: relação inversa Client.payments

-- ─── ServiceOrder: novos campos de agendamento ───────────────────────────────

ALTER TABLE "ServiceOrder"
  ADD COLUMN "scheduledStart" TIMESTAMP(3),
  ADD COLUMN "scheduledEnd"   TIMESTAMP(3);

-- ─── ServiceOrder: índices de performance ─────────────────────────────────────

CREATE INDEX "ServiceOrder_dueDate_idx"        ON "ServiceOrder"("dueDate");
CREATE INDEX "ServiceOrder_createdAt_idx"      ON "ServiceOrder"("createdAt");
CREATE INDEX "ServiceOrder_scheduledStart_idx" ON "ServiceOrder"("scheduledStart");
CREATE INDEX "ServiceOrder_scheduledEnd_idx"   ON "ServiceOrder"("scheduledEnd");

-- ─── Product: índices de performance ─────────────────────────────────────────

CREATE INDEX "Product_name_idx"     ON "Product"("name");
CREATE INDEX "Product_minStock_idx" ON "Product"("minStock");

-- ─── StockMovement: índices de performance ───────────────────────────────────

CREATE INDEX "StockMovement_userId_idx"          ON "StockMovement"("userId");
CREATE INDEX "StockMovement_type_createdAt_idx"  ON "StockMovement"("type", "createdAt");

-- ─── Client: índices de performance ──────────────────────────────────────────

CREATE INDEX "Client_name_idx"      ON "Client"("name");
CREATE INDEX "Client_phone_idx"     ON "Client"("phone");
CREATE INDEX "Client_city_idx"      ON "Client"("city");
CREATE INDEX "Client_isBlocked_idx" ON "Client"("isBlocked");

-- ─── Chip: índices de performance ────────────────────────────────────────────

CREATE INDEX "Chip_serviceOrderId_idx" ON "Chip"("serviceOrderId");
CREATE INDEX "Chip_installedAt_idx"    ON "Chip"("installedAt");

-- ─── AuditLog: índice por action ─────────────────────────────────────────────

CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- ─── Payment: novos campos e índices ─────────────────────────────────────────

ALTER TABLE "Payment"
  ADD COLUMN "reference"    TEXT,
  ADD COLUMN "description"  TEXT;

CREATE INDEX "Payment_status_idx"  ON "Payment"("status");
CREATE INDEX "Payment_dueDate_idx" ON "Payment"("dueDate");
CREATE INDEX "Payment_paidAt_idx"  ON "Payment"("paidAt");

-- ─── FinancialMovementType: adicionar REVERSAL ────────────────────────────────

ALTER TYPE "FinancialMovementType" ADD VALUE IF NOT EXISTS 'REVERSAL';

-- ─── Attachment: soft delete fields e índices ────────────────────────────────

ALTER TABLE "Attachment"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedBy" TEXT;

CREATE INDEX "Attachment_uploadedBy_idx" ON "Attachment"("uploadedBy");
CREATE INDEX "Attachment_createdAt_idx"  ON "Attachment"("createdAt");
