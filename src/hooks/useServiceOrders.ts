import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";

export interface ServiceOrder {
  id: string;
  status: string;
  [key: string]: unknown;
}

export interface ServiceOrdersResponse {
  serviceOrders: ServiceOrder[];
  totalPages: number;
}

export interface ListParams {
  page?: number;
  status?: string;
  search?: string;
}

async function fetchServiceOrders(params: ListParams): Promise<ServiceOrdersResponse> {
  const { data } = await apiClient.get("/service-orders", { params });
  return data;
}

async function updateServiceOrderStatus(id: string, status: string): Promise<ServiceOrder> {
  const { data } = await apiClient.patch(`/service-orders/${id}/status`, { status });
  return data;
}

export function useServiceOrders(params: ListParams = {}) {
  return useQuery({
    queryKey: ["service-orders", params],
    queryFn: () => fetchServiceOrders(params),
  });
}

export function useUpdateServiceOrderStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateServiceOrderStatus(id, status),

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
        context.previous.forEach(([key, data]) => {
          qc.setQueryData(key, data);
        });
      }
      toast.error("Erro ao atualizar status da OS.");
    },

    onSuccess: () => {
      toast.success("Status atualizado com sucesso.");
      qc.invalidateQueries({ queryKey: ["service-orders"] });
    },
  });
}
