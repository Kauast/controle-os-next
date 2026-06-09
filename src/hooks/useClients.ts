import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";

export interface Client {
  id: string;
  name: string;
  document: string;
  phone?: string;
  email?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  contactName?: string;
  chipIds: string[];
  isBlocked: boolean;
  blockedReason?: string;
  createdAt: string;
  serviceOrders?: Array<{
    id: string;
    number: number;
    status: string;
    description?: string;
    chipId?: string;
    createdAt: string;
    technician?: { name: string } | null;
  }>;
}

interface ClientsResponse {
  clients: Client[];
  total: number;
  totalPages: number;
}

interface CreateClientData {
  name: string;
  document: string;
  phone?: string;
  email?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  contactName?: string;
}

interface UpdateClientData extends Partial<CreateClientData> {
  isBlocked?: boolean;
  blockedReason?: string;
}

export interface ImportClientRow {
  name: string;
  document: string;
  phone?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  contactName?: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

export function useClients(search?: string) {
  return useQuery({
    queryKey: ["clients", search],
    queryFn: async () => {
      const { data } = await apiClient.get<ClientsResponse>("/clients", {
        params: { limit: 100, search },
      });
      return data;
    },
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ["clients", id],
    queryFn: async () => {
      const { data } = await apiClient.get<Client>(`/clients/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateClientData) => {
      const { data } = await apiClient.post<Client>("/clients", input);
      return data;
    },
    onSuccess: () => {
      toast.success("Cliente cadastrado com sucesso.");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao cadastrar cliente.");
    },
  });
}

export function useImportClients() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: ImportClientRow[]) => {
      const { data } = await apiClient.post<ImportResult>("/clients/import", { items });
      return data;
    },
    onSuccess: (result) => {
      toast.success(`${result.created} clientes importados. ${result.skipped} já existiam.`);
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao importar clientes.");
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateClientData & { id: string }) => {
      const { data: result } = await apiClient.put<Client>(`/clients/${id}`, data);
      return result;
    },
    onSuccess: () => {
      toast.success("Cliente atualizado.");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar cliente.");
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/clients/${id}`);
    },
    onSuccess: () => {
      toast.success("Cliente removido.");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao remover cliente.");
    },
  });
}
