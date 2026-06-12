"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mobileApiClient } from "@/lib/api/mobile-client";
import { enqueue } from "@/lib/mobile/offline-queue";
import { getNetworkStatus } from "@/lib/mobile/network";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MobileClient {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface MobileExecution {
  checkinAt?: string | null;
  checkoutAt?: string | null;
  checkinLat?: number | null;
  checkinLng?: number | null;
  checkoutLat?: number | null;
  checkoutLng?: number | null;
  photoUrls?: string[];
  clientSignature?: string | null;
  workDoneNotes?: string | null;
}

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
  return useMutation({
    mutationFn: async (payload: CheckinPayload) => {
      const online = await getNetworkStatus();
      if (online === "offline") {
        enqueue({ serviceOrderId, type: "UPDATE_STATUS", payload: { status: "IN_PROGRESS" } });
        enqueue({ serviceOrderId, type: "CHECKIN", payload: payload as unknown as Record<string, unknown> });
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
  });
}

interface UpdateExecutionPayload {
  photoUrls?: string[];
  clientSignature?: string;
  chipIccid?: string;
  checkoutAt?: string;
  checkoutLat?: number;
  checkoutLng?: number;
  workDoneNotes?: string;
}

export function useUpdateExecution(serviceOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateExecutionPayload) => {
      const online = await getNetworkStatus();
      if (online === "offline") {
        enqueue({
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
  });
}

export function useCompleteOS(serviceOrderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      checkoutAt: string;
      checkoutLat?: number;
      checkoutLng?: number;
    }) => {
      const online = await getNetworkStatus();
      if (online === "offline") {
        enqueue({
          serviceOrderId,
          type: "UPDATE_EXECUTION",
          payload: payload as Record<string, unknown>,
        });
        enqueue({
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
  });
}

// ─── Upload helpers ──────────────────────────────────────────────────────────

export async function uploadPhotoBlob(blob: Blob, filename = "photo.jpg"): Promise<string> {
  const form = new FormData();
  form.append("file", blob, filename);
  const { data } = await mobileApiClient.post<{ url: string }>("/uploads", form, {
    headers: { "Content-Type": undefined as unknown as string }, // deixa axios definir o boundary
  });
  return data.url;
}

export async function uploadSignatureDataUrl(dataUrl: string, orderId: string): Promise<string> {
  const [, base64] = dataUrl.split(",");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "image/png" });
  const form = new FormData();
  form.append("file", blob, `signature-${orderId}.png`);
  const { data } = await mobileApiClient.post<{ url: string }>("/uploads", form, {
    headers: { "Content-Type": undefined as unknown as string },
  });
  return data.url;
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
