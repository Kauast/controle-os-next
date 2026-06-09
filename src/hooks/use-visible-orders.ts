"use client";

import { useMemo } from "react";
import { access } from "@/lib/access";
import { useAppStore } from "@/store/use-app-store";

export function useVisibleOrders() {
  const role = useAppStore((s) => s.role);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const orders = useAppStore((s) => s.orders);

  return useMemo(() => {
    if (access.seesAllOrders(role)) return orders;
    return orders.filter((o) => o.team === activeTeam);
  }, [role, activeTeam, orders]);
}
