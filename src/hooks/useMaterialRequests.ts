"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";

export interface MaterialRequest {
  id: string;
  serviceOrderId: string;
  productId: string;
  quantity: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedBy?: string;
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
  product: { id: string; name: string; sku: string; stockQuantity: number };
  serviceOrder?: { id: string; number: number; client: { name: string } };
}

export function useMaterialRequests(serviceOrderId?: string) {
  return useQuery({
    queryKey: ["material-requests", serviceOrderId],
    queryFn: async () => {
      const { data } = await apiClient.get<MaterialRequest[]>("/material-requests", {
        params: serviceOrderId ? { serviceOrderId } : {},
      });
      return data;
    },
    staleTime: 30_000,
  });
}

export function useCreateMaterialRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { serviceOrderId: string; productId: string; quantity: number; requestedBy?: string }) => {
      const { data } = await apiClient.post<MaterialRequest>("/material-requests", input);
      return data;
    },
    onSuccess: () => {
      toast.success("Solicitação enviada.");
      qc.invalidateQueries({ queryKey: ["material-requests"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao solicitar material.");
    },
  });
}

export function useReviewMaterialRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      reviewNote,
      reviewedBy,
    }: {
      id: string;
      status: "APPROVED" | "REJECTED";
      reviewNote?: string;
      reviewedBy?: string;
    }) => {
      const { data } = await apiClient.patch<MaterialRequest>(`/material-requests/${id}/review`, {
        status,
        reviewNote,
        reviewedBy,
      });
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.status === "APPROVED" ? "Solicitação aprovada." : "Solicitação rejeitada.");
      qc.invalidateQueries({ queryKey: ["material-requests"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao revisar solicitação.");
    },
  });
}

export function useDeleteMaterialRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/material-requests/${id}`);
    },
    onSuccess: () => {
      toast.success("Solicitação cancelada.");
      qc.invalidateQueries({ queryKey: ["material-requests"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao cancelar solicitação.");
    },
  });
}
