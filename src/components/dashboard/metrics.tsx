"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, ClipboardList, PackageX, Users, Zap } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { access } from "@/lib/access";
import { TEAMS } from "@/lib/types";
import { useAppStore } from "@/store/use-app-store";
import { useProducts } from "@/hooks/useProducts";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { SERVICE_ORDERS_PAGE_LIMIT } from "@/lib/constants";
import { apiClient } from "@/lib/api/client";

interface DashboardMetrics {
  orders: { open: number; inProgress: number; urgent: number; completedToday: number };
  stock: { critical: number };
  technicians: { busy: number; available: number; total: number };
}

export function Metrics() {
  const role = useAppStore((s) => s.role);

  const { data: osData, isLoading: loadingOS } = useServiceOrders({ limit: SERVICE_ORDERS_PAGE_LIMIT });
  const apiOrders = osData?.serviceOrders ?? [];
  const { data: products = [] } = useProducts();
  const { data: technicians = [] } = useTechnicians();

  const { data: dashboardData } = useQuery<DashboardMetrics>({
    queryKey: ["dashboard-metrics"],
    queryFn: () => apiClient.get<DashboardMetrics>("/reports/dashboard").then((r) => r.data),
    staleTime: 30_000,
  });

  const today = new Date().toISOString().split("T")[0];

  const abertas       = dashboardData?.orders?.open ?? apiOrders.filter((o) => o.status === "OPEN").length;
  const emAndamento   = dashboardData?.orders?.inProgress ?? apiOrders.filter((o) => o.status === "IN_PROGRESS" || o.status === "WAITING_PARTS").length;
  const atrasadas     = dashboardData?.orders?.urgent ?? apiOrders.filter((o) =>
    o.priority === "HIGH" && (o.status === "OPEN" || o.status === "IN_PROGRESS")
  ).length;
  const concluidasHoje = dashboardData?.orders?.completedToday ?? apiOrders.filter((o) =>
    o.status === "COMPLETED" && (o.checkoutAt ?? "").startsWith(today)
  ).length;

  const disponiveis = dashboardData?.technicians?.available ?? TEAMS.filter((team) => {
    const techs = technicians.filter((t) => t.team === team);
    return !techs.some((t) => t.status && t.status !== "Disponivel");
  }).length;

  const critico = access.stock(role)
    ? (dashboardData?.stock?.critical ?? products.filter((p) => p.qty <= p.min && p.min > 0).length)
    : null;

  if (loadingOS) {
    return (
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-[16px] border border-line bg-panel" />
        ))}
      </section>
    );
  }

  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard
        index={0}
        label="OS Abertas"
        value={abertas}
        hint="Aguardando atribuição"
        icon={<ClipboardList className="size-3.5" />}
      />
      <StatCard
        index={1}
        label="Em Andamento"
        value={emAndamento}
        hint="Em execução ou aguardando peças"
        warn={emAndamento > 0}
        icon={<Zap className="size-3.5" />}
      />
      <StatCard
        index={2}
        label="OS Atrasadas"
        value={atrasadas}
        hint="Alta prioridade em aberto"
        alert={atrasadas > 0}
        icon={<AlertTriangle className="size-3.5" />}
      />
      <StatCard
        index={3}
        label="Concluídas Hoje"
        value={concluidasHoje}
        hint="Check-out registrado hoje"
        success={concluidasHoje > 0}
        icon={<CheckCircle2 className="size-3.5" />}
      />
      <StatCard
        index={4}
        label="Equipes Disponíveis"
        value={disponiveis}
        hint={`De ${TEAMS.length} equipes no total`}
        success={disponiveis > 0}
        icon={<Users className="size-3.5" />}
      />
      {critico !== null && (
        <StatCard
          index={5}
          label="Estoque Crítico"
          value={critico}
          hint="Itens abaixo do mínimo"
          alert={critico > 0}
          icon={<PackageX className="size-3.5" />}
        />
      )}
      <StatCard
        index={critico !== null ? 6 : 5}
        label="Total OS Abertas"
        value={abertas + emAndamento}
        hint="Abertas + em andamento"
        icon={<Clock className="size-3.5" />}
      />
    </section>
  );
}
