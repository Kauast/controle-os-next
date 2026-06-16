import { z } from 'zod';

// Query params para listagem
export const listAttachmentsQuerySchema = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().min(1),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListAttachmentsQuery = z.infer<typeof listAttachmentsQuerySchema>;

// Params de rota
export const attachmentParamsSchema = z.object({
  id: z.string().min(1),
});

export type AttachmentParams = z.infer<typeof attachmentParamsSchema>;

// Campos extras enviados no multipart junto ao arquivo
export const uploadFieldsSchema = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().min(1),
});

export type UploadFields = z.infer<typeof uploadFieldsSchema>;

// Shape da resposta de metadados do attachment
export interface AttachmentResponse {
  id: string;
  companyId: string;
  entityType: string;
  entityId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string | null;
  hash: string | null;
  uploadedBy: string;
  createdAt: Date;
}
