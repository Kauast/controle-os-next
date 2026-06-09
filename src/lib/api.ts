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
    materialSold: 0,
    servicesScheduled: 0,
    forecast: 0,
    stockValue,
    monthly: [],
  });
}
