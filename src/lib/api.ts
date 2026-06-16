import { apiClient } from "@/lib/api/client";

type TeamReportApiRow = {
  team: string;
  completed: number;
  total: number;
  status: string;
  pill: "teal" | "amber" | "red" | "blue" | "orange" | "dark" | "neutral";
};

type TeamReportUiRow = {
  team: string;
  completed: number;
  time: string;
  photos: number;
  status: string;
  pill: "teal" | "amber" | "red" | "blue" | "orange" | "dark" | "neutral";
};

type FinanceSummary = {
  materialSold: number;
  servicesScheduled: number;
  forecast: number;
  stockValue: number;
  monthly: Array<{
    month: string;
    material: number;
    services: number;
    forecast: number;
    stock: number;
  }>;
};

type AttendantRow = {
  name: string;
  email: string;
  role: string;
  instructed: number;
  redirected: number;
  pending: number;
  last: string;
};

export async function fetchTeamReport(filterTeam: string): Promise<TeamReportUiRow[]> {
  const { data } = await apiClient.get<TeamReportApiRow[]>("/reports/team", {
    params: filterTeam !== "all" ? { team: filterTeam } : undefined,
  });

  const grouped = new Map<string, TeamReportUiRow>();

  for (const row of data) {
    const current = grouped.get(row.team);
    if (!current) {
      grouped.set(row.team, {
        team: row.team,
        completed: row.completed,
        time: `${Math.max(1, row.total || row.completed)}h`,
        photos: row.completed * 3,
        status: row.status,
        pill: row.pill,
      });
      continue;
    }

    current.completed += row.completed;
    current.photos += row.completed * 3;
    if (row.status !== "Disponivel") {
      current.status = row.status;
      current.pill = row.pill;
    }
  }

  return Array.from(grouped.values()).sort((a, b) => b.completed - a.completed);
}

export async function fetchFinance(): Promise<FinanceSummary> {
  const { data } = await apiClient.get<FinanceSummary>("/reports/finance");
  return data;
}

export async function fetchAttendantReport(): Promise<AttendantRow[]> {
  const { data } = await apiClient.get<AttendantRow[]>("/reports/attendants");
  return data;
}
