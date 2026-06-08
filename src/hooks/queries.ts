"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchFinance, fetchTeamReport } from "@/lib/api";
import { useAppStore } from "@/store/use-app-store";

export function useTeamReport(filterTeam: string) {
  const ordersVersion = useAppStore((s) => s.orders.length);
  return useQuery({
    queryKey: ["team-report", filterTeam, ordersVersion],
    queryFn: () => fetchTeamReport(filterTeam),
  });
}

export function useFinance() {
  const productsVersion = useAppStore((s) => s.products.length);
  return useQuery({
    queryKey: ["finance", productsVersion],
    queryFn: fetchFinance,
  });
}
