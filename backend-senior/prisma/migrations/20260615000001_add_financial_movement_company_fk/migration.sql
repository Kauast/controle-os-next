-- Add FK to Company for FinancialMovement
ALTER TABLE "FinancialMovement" ADD CONSTRAINT "FinancialMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add back-relation in Company
-- Note: This is a schema documentation change only in Prisma, no SQL needed
