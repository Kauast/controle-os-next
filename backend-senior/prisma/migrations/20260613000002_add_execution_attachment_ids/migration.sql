-- Novo contrato de mídia de execução: IDs de anexos privados (Attachment)
-- em vez de URLs públicas. Mantém photoUrls/clientSignature legados.
ALTER TABLE "ServiceOrderExecution"
  ADD COLUMN "photoAttachmentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "signatureAttachmentId" TEXT;
