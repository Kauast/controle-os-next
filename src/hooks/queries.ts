"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchFinance, fetchTeamReport, fetchAttendantReport } from "@/lib/api";

export function useTeamReport(filterTeam: string) {
  return useQuery({
    queryKey: ["team-report", filterTeam],
    queryFn: () => fetchTeamReport(filterTeam),
    staleTime: 30_000,
  });
}

export function useFinance() {
  return useQuery({
    queryKey: ["finance"],
    queryFn: fetchFinance,
    staleTime: 30_000,
  });
}

export function useAttendantReport() {
  return useQuery({
    queryKey: ["attendant-report"],
    queryFn: fetchAttendantReport,
    staleTime: 30_000,
  });
}
