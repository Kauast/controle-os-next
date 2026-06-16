"use client";

import { useMemo } from "react";
import { access } from "@/lib/access";
import { useAppStore } from "@/store/use-app-store";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { adaptBackendOrders } from "@/lib/adapters";
import { SERVICE_ORDERS_PAGE_LIMIT } from "@/lib/constants";
import type { ServiceOrder } from "@/lib/types";

export function useVisibleOrders(): (ServiceOrder & { _backendId: string })[] {
  const role = useAppStore((s) => s.role);
  const activeTeam = useAppStore((s) => s.activeTeam);

  const { data } = useServiceOrders({ limit: SERVICE_ORDERS_PAGE_LIMIT });
  const adapted = useMemo(
    () => adaptBackendOrders(data?.serviceOrders ?? []),
    [data],
  );

  return useMemo(() => {
    if (access.seesAllOrders(role)) return adapted;
    return adapted.filter((o) => o.team === activeTeam);
  }, [role, activeTeam, adapted]);
}
