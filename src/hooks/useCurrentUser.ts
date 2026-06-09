"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface CurrentUser {
  id: string;
  email: string;
  role: string;
  technician?: {
    id: string;
    name: string;
    team: string;
    phone?: string;
  } | null;
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await apiClient.get<CurrentUser>("/auth/me");
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
