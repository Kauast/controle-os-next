-- Adiciona campos de mídia à tabela ServiceOrderExecution
-- photoUrls: array de URLs das fotos (antes/durante/depois)
-- clientSignature: URL da imagem de assinatura do cliente

ALTER TABLE "ServiceOrderExecution"
  ADD COLUMN IF NOT EXISTS "photoUrls"       TEXT[]   NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "clientSignature" TEXT;
