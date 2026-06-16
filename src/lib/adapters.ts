import type { ServiceOrder as BackendServiceOrder } from "@/hooks/useServiceOrders";
import type { ServiceOrder } from "@/lib/types";

const PRIORITY_MAP: Record<string, ServiceOrder["priority"]> = {
  HIGH: "high",
  WARNING: "warning",
  NORMAL: "normal",
};

const STATUS_MAP: Record<string, ServiceOrder["status"]> = {
  OPEN: "pending",
  IN_PROGRESS: "pending",
  WAITING_PARTS: "pending",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export function adaptBackendOrder(os: BackendServiceOrder): ServiceOrder & { _backendId: string } {
  const clientName = typeof os.client === "object" && os.client !== null
    ? (os.client as { name: string }).name
    : String(os.client ?? "");

  const techName = os.technician
    ? (os.technician as { name: string }).name
    : "";

  return {
    code: `OS-${String(os.number).padStart(4, "0")}`,
    client: clientName,
    description: os.description ?? "",
    tech: techName,
    time: os.scheduledTime ?? os.scheduledStart?.slice(11, 16) ?? "00:00",
    scheduledStart: os.scheduledStart ?? null,
    team: os.team ?? "Sem equipe",
    priority: PRIORITY_MAP[os.priority] ?? "normal",
    status: STATUS_MAP[os.status] ?? "pending",
    scheduledDate: os.dueDate ? os.dueDate.split("T")[0] : undefined,
    _backendId: os.id,
  };
}

export function adaptBackendOrders(list: BackendServiceOrder[]): (ServiceOrder & { _backendId: string })[] {
  return list.map(adaptBackendOrder);
}
