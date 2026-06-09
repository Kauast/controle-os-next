import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import type { Technician } from "@/lib/types";

interface ApiTechnician {
  id: string;
  userId: string;
  name: string;
  phone: string;
  team: string;
  statusField: string;
  specialty?: string;
  isActive: boolean;
}

function toFrontendTechnician(t: ApiTechnician, index: number): Technician & { _apiId: string } {
  return {
    id: index + 1,
    _apiId: t.id,
    name: t.name,
    phone: t.phone || "",
    status: t.statusField || "Disponivel",
    team: t.team || "Equipe 1",
  };
}

interface CreateTechnicianData {
  userId: string;
  name: string;
  phone?: string;
  team?: string;
  specialty?: string;
}

interface UpdateTechnicianData {
  apiId: string;
  name?: string;
  phone?: string;
  team?: string;
  statusField?: string;
}

export function useTechnicians() {
  return useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiTechnician[]>("/technicians");
      return data.map(toFrontendTechnician);
    },
  });
}

export function useCreateTechnician() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTechnicianData) => {
      const { data } = await apiClient.post<ApiTechnician>("/technicians", input);
      return data;
    },
    onSuccess: () => {
      toast.success("Técnico cadastrado com sucesso.");
      qc.invalidateQueries({ queryKey: ["technicians"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao cadastrar técnico.");
    },
  });
}

export function useUpdateTechnician() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ apiId, ...rest }: UpdateTechnicianData) => {
      const { data } = await apiClient.put(`/technicians/${apiId}`, rest);
      return data;
    },
    onSuccess: () => {
      toast.success("Técnico atualizado.");
      qc.invalidateQueries({ queryKey: ["technicians"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar técnico.");
    },
  });
}

export function useDeactivateTechnician() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (apiId: string) => {
      const { data } = await apiClient.patch(`/technicians/${apiId}/deactivate`);
      return data;
    },
    onSuccess: () => {
      toast.success("Técnico desativado.");
      qc.invalidateQueries({ queryKey: ["technicians"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao desativar técnico.");
    },
  });
}
