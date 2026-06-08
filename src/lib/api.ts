import { teamCompletedBase, teamReportMeta } from "@/lib/seed";
import { useAppStore } from "@/store/use-app-store";
import { TEAMS } from "@/lib/types";

function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export interface TeamReportRow {
  team: string;
  completed: number;
  time: string;
  photos: string;
  signatures: string;
  status: string;
  pill: "teal" | "amber";
}

export async function fetchTeamReport(filterTeam: string): Promise<TeamReportRow[]> {
  const orders = useAppStore.getState().orders;
  const teams = filterTeam === "all" ? [...TEAMS] : [filterTeam];
  const rows = teams.map((team) => {
    const completedNow = orders.filter((o) => o.team === team && o.status === "completed").length;
    const meta = teamReportMeta[team];
    return {
      team,
      completed: (teamCompletedBase[team] ?? 0) + completedNow,
      time: meta.time,
      photos: meta.photos,
      signatures: meta.signatures,
      status: meta.status,
      pill: meta.pill,
    };
  });
  return delay(rows);
}

export interface FinanceSummary {
  materialSold: number;
  servicesScheduled: number;
  forecast: number;
  stockValue: number;
  monthly: {
    month: string;
    material: number;
    services: number;
    forecast: number;
    stock: number;
  }[];
}

export async function fetchFinance(): Promise<FinanceSummary> {
  const products = useAppStore.getState().products;
  const stockValue = products.reduce((sum, p) => sum + p.cost * p.qty, 0);
  return delay({
    materialSold: 34600,
    servicesScheduled: 51800,
    forecast: 86400,
    stockValue,
    monthly: [
      { month: "Mar/2026", material: 27400, services: 44200, forecast: 71600, stock: 121300 },
      { month: "Abr/2026", material: 31850, services: 48900, forecast: 80750, stock: 126700 },
      { month: "Mai/2026", material: 29600, services: 46400, forecast: 76000, stock: 119500 },
      { month: "Jun/2026", material: 34600, services: 51800, forecast: 86400, stock: stockValue },
    ],
  });
}
