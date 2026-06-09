import type {
  MaterialRequest,
  Product,
  ServiceOrder,
  StockMovement,
  TeamAccount,
  TeamLocation,
  Technician,
} from "./types";

export const seedTeamAccounts: TeamAccount[] = [];

export const seedOrders: ServiceOrder[] = [];

export const seedProducts: Product[] = [];

export const seedMovements: StockMovement[] = [];

export const seedRequests: MaterialRequest[] = [];

export const seedTechnicians: Technician[] = [];

export const seedLocations: TeamLocation[] = [];

export const teamCompletedBase: Record<string, number> = {};

export const teamReportMeta: Record<
  string,
  { time: string; photos: string; signatures: string; status: string; pill: "teal" | "amber" }
> = {};
