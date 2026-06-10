import type { ServiceOrder } from "./types";
import { currentMonthValue } from "./utils";

export function priorityRank(o: ServiceOrder) {
  if (o.status === "completed") return 2;
  if (o.priority === "high") return 0;
  if (o.priority === "warning") return 1;
  return 2;
}

export function scheduleMinutes(time: string) {
  const m = time?.match(/(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 9999;
}

export function sortOrders(orders: ServiceOrder[]) {
  return [...orders].sort(
    (a, b) => priorityRank(a) - priorityRank(b) || scheduleMinutes(a.time) - scheduleMinutes(b.time),
  );
}

export function orderTone(o: ServiceOrder): "high" | "warning" | "completed" | "normal" {
  if (o.status === "completed") return "completed";
  if (o.priority === "high") return "high";
  if (o.priority === "warning") return "warning";
  return "normal";
}

export function orderLabel(o: ServiceOrder): { text: string; pill: "teal" | "amber" | "red" } {
  if (o.status === "completed") return { text: "Concluida", pill: "teal" };
  if (o.priority === "high") return { text: "Alta", pill: "red" };
  if (o.priority === "warning") return { text: "Pendente", pill: "amber" };
  return { text: "Agenda", pill: "teal" };
}

const fallbackDays: Record<string, string> = {};

export function orderCalendarDate(o: ServiceOrder) {
  if (o.scheduledDate) return o.scheduledDate;
  const day = fallbackDays[o.code];
  return day ? `${currentMonthValue()}-${day}` : "";
}

export const toneBorder: Record<string, string> = {
  high: "border-l-[3px] border-l-status-critical",
  warning: "border-l-[3px] border-l-status-waiting",
  completed: "border-l-[3px] border-l-status-done",
  normal: "border-l-[3px] border-l-status-open",
};
