"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { mobileApiClient } from "@/lib/api/mobile-client";
import { enqueue } from "@/lib/mobile/offline-queue";
import { getNetworkStatus } from "@/lib/mobile/network";
import type { OsExecution, OsClient } from "@/lib/domain/service-order";

// ─── Types ───────────────────────────────────────────────────────────────────

/** @see OsClient in src/lib/domain/service-order.ts */
export type MobileClient = OsClient;

/** @see OsExecution in src/lib/domain/service-order.ts */
export type MobileExecution = OsExecution;

/**
 * Service Order shape returned by the mobile API endpoints.
 * Uses the canonical sub-types (OsClient, OsExecution) from the domain layer.
 *
 * NOTE: `number` is numeric here (legacy mobile API contract).
 * `openingDate`/`dueDate` are mobile-specific field names.
 */
export interface MobileServiceOrder {
  id: string;
  number: number;
  status: "OPEN" | "IN_PROGRESS" | "WAITING_PARTS" | "COMPLETED" | "CANCELLED";
  priority: "NORMAL" | "WARNING" | "HIGH" | "CRITICAL";
  description?: string | null;
  openingDate: string;
  dueDate: string;
  client: MobileClient;
  technician?: { id: string; name: string } | null;
  chipIccid?: string | null;
  execution?: MobileExecution | null;
}

export interface MobileListResponse {
  serviceOrders: MobileServiceOrder[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CurrentUserMobile {
  id: string;
  name?: string | null;
  email: string;
  role: string;
  technician?: { id: string; name: string; phone?: string } | null;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export function useCurrentUserMobile() {
  return useQuery<CurrentUserMobile>({
    queryKey: ["mobile", "me"],
    queryFn: async () => {
      const { data } = await mobileApiClient.get<CurrentUserMobile>("/auth/me");
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    gcTime: 10 * 60 * 1000,
  });
}

// ─── Service Orders ──────────────────────────────────────────────────────────

export function useTechnicianOrders(technicianId: string | undefined | null) {
  return useQuery<MobileServiceOrder[]>({
    queryKey: ["mobile", "orders", technicianId],
    queryFn: async () => {
      const { data } = await mobileApiClient.get<MobileListResponse>("/service-orders", {
        params: { technicianId, limit: 50 },
      });
      return data.serviceOrders ?? [];
    },
    enabled: !!technicianId,
    staleTime: 30 * 1000,
    retry: 1,
    gcTime: 5 * 60 * 1000,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

interface CheckinPayload {
  checkinAt: string;
  checkinLat?: number;
  checkinLng?: number;
  checkinLocation?: string;
}

export function useCheckin(serviceOrderId: string) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUserMobile();
  return useMutation({
    mutationFn: async (payload: CheckinPayload) => {
      if (!me?.id) throw new Error("Usuário não autenticado.");
      const userId = me.id;
      const online = await getNetworkStatus();
      if (online === "offline") {
        enqueue({ userId, serviceOrderId, type: "UPDATE_STATUS", payload: { status: "IN_PROGRESS" } });
        enqueue({ userId, serviceOrderId, type: "CHECKIN", payload: payload as unknown as Record<string, unknown> });
        return null;
      }
      await mobileApiClient.patch(`/service-orders/${serviceOrderId}/status`, {
        status: "IN_PROGRESS",
      });
      const { data } = await mobileApiClient.patch(
        `/service-orders/${serviceOrderId}/execution`,
        payload
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mobile", "orders"] }),
    onError: () => toast.error("Erro: usuário não autenticado. Faça login novamente."),
  });
}

interface UpdateExecutionPayload {
  /** @deprecated Use photoAttachmentIds. Mantido enquanto o backend migra. */
  photoUrls?: string[];
  photoAttachmentIds?: string[];
  /** @deprecated Use signatureAttachmentId. Mantido enquanto o backend migra. */
  clientSignature?: string;
  signatureAttachmentId?: string;
  chipIccid?: string;
  checkoutAt?: string;
  checkoutLat?: number;
  checkoutLng?: number;
  workDoneNotes?: string;
}

export function useUpdateExecution(serviceOrderId: string) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUserMobile();
  return useMutation({
    mutationFn: async (payload: UpdateExecutionPayload) => {
      if (!me?.id) throw new Error("Usuário não autenticado.");
      const userId = me.id;
      const online = await getNetworkStatus();
      if (online === "offline") {
        enqueue({
          userId,
          serviceOrderId,
          type: "UPDATE_EXECUTION",
          payload: payload as Record<string, unknown>,
        });
        return null;
      }
      const { data } = await mobileApiClient.patch(
        `/service-orders/${serviceOrderId}/execution`,
        payload
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mobile", "orders"] }),
    onError: () => toast.error("Erro: usuário não autenticado. Faça login novamente."),
  });
}

export function useCompleteOS(serviceOrderId: string) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUserMobile();
  return useMutation({
    mutationFn: async (payload: {
      checkoutAt: string;
      checkoutLat?: number;
      checkoutLng?: number;
    }) => {
      if (!me?.id) throw new Error("Usuário não autenticado.");
      const userId = me.id;
      const online = await getNetworkStatus();
      if (online === "offline") {
        enqueue({
          userId,
          serviceOrderId,
          type: "UPDATE_EXECUTION",
          payload: payload as Record<string, unknown>,
        });
        enqueue({
          userId,
          serviceOrderId,
          type: "COMPLETE_OS",
          payload: { status: "COMPLETED" },
        });
        return null;
      }
      await mobileApiClient.patch(`/service-orders/${serviceOrderId}/execution`, payload);
      const { data } = await mobileApiClient.patch(
        `/service-orders/${serviceOrderId}/status`,
        { status: "COMPLETED" }
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mobile", "orders"] }),
    onError: () => toast.error("Erro: usuário não autenticado. Faça login novamente."),
  });
}

// ─── Upload helpers ──────────────────────────────────────────────────────────

interface UploadResponse {
  attachmentId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  entityType?: string;
  entityId?: string;
}

/**
 * Envia um Blob para /uploads e retorna o attachmentId gerado pelo backend.
 * O download posterior e feito via /api/attachments/:id/download (autenticado).
 */
export async function uploadPhotoBlob(blob: Blob, orderId: string, filename = "photo.jpg"): Promise<string> {
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("serviceOrderId", orderId);
  const { data } = await mobileApiClient.post<UploadResponse>("/uploads", form, {
    headers: { "Content-Type": undefined as unknown as string }, // deixa axios definir o boundary
  });
  return data.attachmentId;
}

/**
 * Converte um dataUrl base64 em Blob, envia para /uploads e retorna o attachmentId.
 */
export async function uploadSignatureDataUrl(dataUrl: string, orderId: string): Promise<string> {
  const [, base64] = dataUrl.split(",");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "image/png" });
  const form = new FormData();
  form.append("file", blob, `signature-${orderId}.png`);
  form.append("serviceOrderId", orderId);
  const { data } = await mobileApiClient.post<UploadResponse>("/uploads", form, {
    headers: { "Content-Type": undefined as unknown as string },
  });
  return data.attachmentId;
}

// ─── Material Requests ───────────────────────────────────────────────────────

export function useCreateMaterialRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      serviceOrderId: string;
      productId: string;
      quantity: number;
    }) => {
      const { data } = await mobileApiClient.post("/material-requests", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mobile", "orders"] }),
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ["mobile", "products"],
    queryFn: async () => {
      const { data } = await mobileApiClient.get("/products", {
        params: { limit: 200 },
      });
      return (data.products ?? data) as Array<{
        id: string;
        name: string;
        sku: string;
      }>;
    },
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}
