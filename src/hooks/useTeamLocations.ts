"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface TeamLocation {
  team: string;
  members: string;
  x: number;
  y: number;
  speed: number;
  status: string;
  vehicle: string;
  updated: string;
  currentOS: string;
}

async function fetchTeamLocations(): Promise<TeamLocation[]> {
  try {
    const { data } = await apiClient.get<TeamLocation[]>("/reports/locations");
    return data;
  } catch {
    return [];
  }
}

export function useTeamLocations() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["team-locations"],
    queryFn: fetchTeamLocations,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["team-locations"] });
  return { ...query, refresh };
}
