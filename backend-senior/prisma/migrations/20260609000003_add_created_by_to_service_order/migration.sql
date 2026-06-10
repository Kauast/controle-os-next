ALTER TABLE "ServiceOrder" ADD COLUMN "createdById" TEXT;
CREATE INDEX "ServiceOrder_createdById_idx" ON "ServiceOrder"("createdById");
