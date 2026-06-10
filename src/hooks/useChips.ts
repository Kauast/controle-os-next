import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";

export type ChipStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";

export interface Chip {
  id: string;
  iccid: string;
  phoneNumber?: string;
  operator?: string;
  model?: string;
  status: ChipStatus;
  notes?: string;
  clientId?: string;
  client?: { id: string; name: string } | null;
  serviceOrderId?: string;
  serviceOrder?: { id: string; number: number } | null;
  installedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChipData {
  iccid: string;
  phoneNumber?: string;
  operator?: string;
  model?: string;
  status?: ChipStatus;
  notes?: string;
  clientId?: string;
  serviceOrderId?: string;
  installedAt?: string;
}

export function useChips(clientId?: string, status?: ChipStatus) {
  return useQuery({
    queryKey: ["chips", { clientId, status }],
    queryFn: async () => {
      const { data } = await apiClient.get<{ chips: Chip[]; total: number }>(
        "/chips",
        { params: { clientId, status, limit: 200 } }
      );
      return data;
    },
  });
}

export function useClientChips(clientId: string) {
  return useQuery({
    queryKey: ["chips", "client", clientId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ chips: Chip[]; total: number }>(
        "/chips",
        { params: { clientId, limit: 100 } }
      );
      return data.chips;
    },
    enabled: !!clientId,
  });
}

export function useCreateChip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateChipData) => {
      const { data } = await apiClient.post<Chip>("/chips", input);
      return data;
    },
    onSuccess: () => {
      toast.success("Chip cadastrado.");
      qc.invalidateQueries({ queryKey: ["chips"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao cadastrar chip."),
  });
}

export function useUpdateChip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CreateChipData> & { id: string }) => {
      const { data: result } = await apiClient.put<Chip>(`/chips/${id}`, data);
      return result;
    },
    onSuccess: () => {
      toast.success("Chip atualizado.");
      qc.invalidateQueries({ queryKey: ["chips"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao atualizar chip."),
  });
}

export function useTransferChip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string | null }) => {
      const { data } = await apiClient.patch<Chip>(`/chips/${id}/transfer`, { clientId });
      return data;
    },
    onSuccess: () => {
      toast.success("Chip transferido.");
      qc.invalidateQueries({ queryKey: ["chips"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao transferir chip."),
  });
}

export function useDeleteChip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/chips/${id}`);
    },
    onSuccess: () => {
      toast.success("Chip removido.");
      qc.invalidateQueries({ queryKey: ["chips"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao remover chip."),
  });
}
