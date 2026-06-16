import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import type { OsPriority } from "@/lib/domain/service-order";

/**
 * Web admin API shape for a Service Order.
 * Uses OsPriority from the canonical domain type.
 *
 * NOTE: This is NOT ServiceOrderCanonical — the web admin API has different
 * field names (e.g. `chipId` vs `chipIccid`, flat execution fields vs nested).
 */
export interface ServiceOrder {
  id: string;
  number: number;
  status: string;
  team: string;
  priority: OsPriority;
  scheduledTime?: string;
  scheduledStart?: string | null;
  description?: string;
  technicianId?: string;
  checkinAt?: string;
  checkoutAt?: string;
  checkinLocation?: string;
  photoUrls: string[];
  clientSignature?: string;
  chipId?: string;
  dueDate: string;
  totalAmount: number;
  createdAt: string;
  client: { id: string; name: string; phone?: string; email?: string };
  technician?: { id: string; name: string; team: string } | null;
}

export interface ServiceOrdersResponse {
  serviceOrders: ServiceOrder[];
  total: number;
  totalPages: number;
}

export interface ListParams {
  page?: number;
  status?: string;
  team?: string;
  technicianId?: string;
  limit?: number;
}

export interface CreateServiceOrderInput {
  clientId: string;
  dueDate: string;
  technicianId?: string;
  description?: string;
  team?: string;
  priority?: OsPriority;
  scheduledTime?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    itemType: "PRODUCT" | "SERVICE";
    productId?: string;
  }>;
}

async function fetchServiceOrders(params: ListParams): Promise<ServiceOrdersResponse> {
  const { data } = await apiClient.get("/service-orders", { params });
  return data;
}

async function createServiceOrder(input: CreateServiceOrderInput): Promise<ServiceOrder> {
  const { data } = await apiClient.post("/service-orders", input);
  return data;
}

async function updateServiceOrderStatus(id: string, status: string, cancellationReason?: string): Promise<ServiceOrder> {
  const { data } = await apiClient.patch(`/service-orders/${id}/status`, { status, cancellationReason });
  return data;
}

async function assignServiceOrder(
  id: string,
  team: string,
  technicianId?: string | null,
  scheduledStart?: string | null,
): Promise<ServiceOrder> {
  const { data } = await apiClient.patch(`/service-orders/${id}/assign`, {
    team,
    technicianId,
    ...(scheduledStart ? { scheduledStart } : {}),
  });
  return data;
}

async function updateExecution(
  id: string,
  payload: {
    checkinAt?: string;
    checkoutAt?: string;
    checkinLocation?: string;
    photoUrls?: string[];
    clientSignature?: string;
    chipId?: string;
  }
): Promise<ServiceOrder> {
  const { data } = await apiClient.patch(`/service-orders/${id}/execution`, payload);
  return data;
}

export function useServiceOrders(params: ListParams = {}) {
  return useQuery({
    queryKey: ["service-orders", params],
    queryFn: () => fetchServiceOrders(params),
    staleTime: 30_000,
  });
}

export function useServiceOrder(id: string) {
  return useQuery({
    queryKey: ["service-orders", id],
    queryFn: async () => {
      const { data } = await apiClient.get<ServiceOrder>(`/service-orders/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateServiceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateServiceOrderInput) => createServiceOrder(input),
    onSuccess: () => {
      toast.success("OS criada com sucesso.");
      qc.invalidateQueries({ queryKey: ["service-orders"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar OS.");
    },
  });
}

export function useUpdateServiceOrderStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, cancellationReason }: { id: string; status: string; cancellationReason?: string }) =>
      updateServiceOrderStatus(id, status, cancellationReason),

    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["service-orders"] });
      const previous = qc.getQueriesData({ queryKey: ["service-orders"] });

      qc.setQueriesData(
        { queryKey: ["service-orders"] },
        (old: ServiceOrdersResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            serviceOrders: old.serviceOrders.map((os) =>
              os.id === id ? { ...os, status } : os
            ),
          };
        }
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        context.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      }
      toast.error("Erro ao atualizar status da OS.");
    },

    onSuccess: () => {
      toast.success("Status atualizado com sucesso.");
      qc.invalidateQueries({ queryKey: ["service-orders"] });
    },
  });
}

export function useAssignServiceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, team, technicianId, scheduledStart }: {
      id: string;
      team: string;
      technicianId?: string | null;
      scheduledStart?: string | null;
    }) => assignServiceOrder(id, team, technicianId, scheduledStart),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-orders"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atribuir OS.");
    },
  });
}

export function useUpdateExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      checkinAt?: string;
      checkoutAt?: string;
      checkinLocation?: string;
      photoUrls?: string[];
      clientSignature?: string;
      chipId?: string;
    }) => updateExecution(id, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["service-orders"] });
      qc.invalidateQueries({ queryKey: ["service-orders", vars.id] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao salvar dados de execução.");
    },
  });
}

export function useDeleteServiceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/service-orders/${id}`);
      return data;
    },
    onSuccess: () => {
      toast.success("OS excluída com sucesso.");
      qc.invalidateQueries({ queryKey: ["service-orders"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao excluir OS.");
    },
  });
}
