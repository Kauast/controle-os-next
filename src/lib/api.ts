import { apiClient } from "@/lib/api/client";

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
  try {
    const { data } = await apiClient.get<TeamReportRow[]>("/reports/team", {
      params: filterTeam !== "all" ? { team: filterTeam } : undefined,
    });
    return data.map((row) => ({
      ...row,
      time: row.time ?? "—",
      photos: row.photos ?? "—",
      signatures: row.signatures ?? "—",
    }));
  } catch {
    return [];
  }
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
  try {
    const { data } = await apiClient.get<FinanceSummary>("/reports/finance");
    return data;
  } catch {
    return {
      materialSold: 0,
      servicesScheduled: 0,
      forecast: 0,
      stockValue: 0,
      monthly: [],
    };
  }
}
