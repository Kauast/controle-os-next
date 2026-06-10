"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface AppUser {
  id: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

async function fetchUsers(): Promise<AppUser[]> {
  try {
    const { data } = await apiClient.get<AppUser[]>("/reports/users");
    return data;
  } catch {
    return [];
  }
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    staleTime: 30_000,
  });
}
