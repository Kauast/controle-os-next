/**
 * Canonical Service Order types — mirror the backend Prisma schema.
 * Use these in hooks and components that consume real API data.
 *
 * NOTE: The `ServiceOrder` type in src/lib/types.ts is the legacy AppStore
 * shape for mock/demo state — do not confuse them.
 */

export type OsStatus =
  | "ABERTA"
  | "EM_ANDAMENTO"
  | "AGUARDANDO_PECAS"
  | "CONCLUIDA"
  | "CANCELADA"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_PARTS"
  | "COMPLETED"
  | "CANCELLED";

export type OsPriority = "NORMAL" | "WARNING" | "HIGH" | "CRITICAL";

export interface OsClient {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface OsTechnician {
  id: string;
  name: string;
  phone?: string | null;
}

export interface OsExecution {
  checkinAt?: string | null;
  checkoutAt?: string | null;
  checkinLat?: number | null;
  checkinLng?: number | null;
  checkoutLat?: number | null;
  checkoutLng?: number | null;
  /** @deprecated Use photoAttachmentIds */
  photoUrls?: string[];
  photoAttachmentIds?: string[];
  /** @deprecated Use signatureAttachmentId */
  clientSignature?: string;
  signatureAttachmentId?: string;
  chipIccid?: string;
  workDoneNotes?: string;
}

export interface ServiceOrderCanonical {
  id: string;
  number: string;
  status: OsStatus;
  priority: OsPriority;
  description?: string | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  client?: OsClient | null;
  technician?: OsTechnician | null;
  execution?: OsExecution | null;
  /** @deprecated Use execution.photoAttachmentIds */
  photoUrls?: string[];
  /** @deprecated Use execution.signatureAttachmentId */
  clientSignature?: string;
  chipIccid?: string;
}
