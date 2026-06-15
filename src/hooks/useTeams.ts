// src/hooks/useTeams.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface Team {
  id: string;
  name: string;
  members: { id: string; name: string }[];
  online: boolean;
}

async function fetchTeams(): Promise<Team[]> {
  const { data } = await apiClient.get('/teams');
  return data;
}

export function useTeams() {
  return useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: fetchTeams,
    staleTime: 60_000,
  });
}
