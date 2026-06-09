-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('NORMAL', 'WARNING', 'HIGH');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: ServiceOrder — novos campos de despacho e execução
ALTER TABLE "ServiceOrder"
  ADD COLUMN "team"           TEXT        NOT NULL DEFAULT 'Sem equipe',
  ADD COLUMN "priority"       "Priority"  NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "scheduledTime"  TEXT,
  ADD COLUMN "chipId"         TEXT;

-- CreateTable: StockMovement
CREATE TABLE "StockMovement" (
    "id"             TEXT NOT NULL,
    "productId"      TEXT NOT NULL,
    "type"           "MovementType" NOT NULL,
    "quantity"       INTEGER NOT NULL,
    "reason"         TEXT,
    "serviceOrderId" TEXT,
    "userId"         TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MaterialRequest
CREATE TABLE "MaterialRequest" (
    "id"             TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "productId"      TEXT NOT NULL,
    "quantity"       INTEGER NOT NULL,
    "status"         "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy"    TEXT,
    "reviewedBy"     TEXT,
    "reviewNote"     TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: StockMovement → Product
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: StockMovement → ServiceOrder (optional)
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_serviceOrderId_fkey"
  FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: MaterialRequest → ServiceOrder
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_serviceOrderId_fkey"
  FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: MaterialRequest → Product
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
