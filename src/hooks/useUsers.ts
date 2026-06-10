import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";

export interface AppUser {
  id: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await apiClient.get<AppUser[]>("/users");
      return data;
    },
    staleTime: 30_000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string; role: string }) => {
      const { data } = await apiClient.post<AppUser>("/users", input);
      return data;
    },
    onSuccess: () => {
      toast.success("Usuário criado com sucesso.");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar usuário.");
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      role?: string;
      active?: boolean;
    }) => {
      const { data: result } = await apiClient.patch<AppUser>(`/users/${id}`, data);
      return result;
    },
    onSuccess: () => {
      toast.success("Usuário atualizado.");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar usuário.");
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await apiClient.patch(`/users/${id}/password`, { password });
    },
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao redefinir senha.");
    },
  });
}

export function useRemoveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/users/${id}`);
    },
    onSuccess: () => {
      toast.success("Usuário desativado.");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao remover usuário.");
    },
  });
}
