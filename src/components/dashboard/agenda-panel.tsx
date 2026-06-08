"use client";

import { CalendarPlus } from "lucide-react";
import { Card, SectionHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { orderCalendarDate, orderLabel, orderTone, sortOrders, toneBorder } from "@/lib/orders";
import { currentMonthValue, formatDateShort, monthLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useVisibleOrders } from "@/hooks/use-visible-orders";
import { useUIStore } from "@/store/use-ui-store";

function MonthlySchedule() {
  const month = currentMonthValue();
  const orders = sortOrders(
    useVisibleOrders().filter(
      (o) => (o.scheduledMonth || o.scheduledDate?.slice(0, 7) || orderCalendarDate(o).slice(0, 7)) === month,
    ),
  ).slice(0, 6);
  const setScheduleOpen = useUIStore((s) => s.setScheduleOpen);

  return (
    <div className="rounded-[14px] border border-line bg-panel-soft/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="text-xs uppercase text-muted">Planejamento mensal</span>
          <strong className="block text-sm text-ink">OS agendadas de {monthLabel(month)}</strong>
        </div>
        <Button size="sm" onClick={() => setScheduleOpen(true)}>
          <CalendarPlus /> Agendar OS
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {orders.map((o) => {
          const label = orderLabel(o);
          return (
            <article
              key={o.code}
              className={cn(
                "flex items-center gap-3 rounded-[10px] border border-line bg-panel p-2.5",
                toneBorder[orderTone(o)],
              )}
            >
              <div className="grid w-12 shrink-0 place-items-center rounded-[8px] bg-panel-soft py-1 text-center">
                <strong className="text-xs text-ink">{formatDateShort(orderCalendarDate(o))}</strong>
                <span className="text-[10px] text-muted">{o.time}</span>
              </div>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-ink">
                  {o.code} · {o.client}
                </strong>
                <small className="text-xs text-muted">{o.team} · {o.tech || "Sem tecnico"}</small>
              </div>
              <Badge tone={label.pill}>{label.text}</Badge>
            </article>
          );
        })}
        {orders.length === 0 && (
          <p className="py-4 text-center text-xs text-muted">Nenhuma OS agendada neste mes.</p>
        )}
      </div>
    </div>
  );
}

function MonthCalendar() {
  const month = currentMonthValue();
  const [year, m] = month.split("-").map(Number);
  const daysInMonth = new Date(year, m, 0).getDate();
  const startOffset = new Date(year, m - 1, 1).getDay();
  const orders = useVisibleOrders().filter((o) => orderCalendarDate(o).startsWith(month));
  const week = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  return (
    <div className="rounded-[14px] border border-line bg-panel-soft/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="text-xs uppercase text-muted">Calendario do mes</span>
          <strong className="block text-sm capitalize text-ink">{monthLabel(month)}</strong>
        </div>
        <Badge tone="teal">{orders.length} OS</Badge>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {week.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase text-muted">
            {d}
          </div>
        ))}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const dayOrders = orders.filter((o) => orderCalendarDate(o) === date);
          const hasHigh = dayOrders.some((o) => o.priority === "high");
          const hasWarn = dayOrders.some((o) => o.priority === "warning");
          return (
            <div
              key={date}
              className={cn(
                "flex min-h-[52px] flex-col rounded-[8px] border border-line p-1.5 text-left",
                dayOrders.length && "bg-panel",
                hasHigh && "border-red/50 bg-red-soft/40",
                hasWarn && !hasHigh && "border-amber/50 bg-amber-soft/40",
              )}
            >
              <strong className="text-xs text-ink">{day}</strong>
              <span className="text-[9px] text-muted">
                {dayOrders.length ? `${dayOrders.length} OS` : "Livre"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AgendaPanel() {
  return (
    <Card>
      <SectionHeading eyebrow="Agenda das equipes" title="Planejamento e calendario" />
      <div className="grid gap-4 xl:grid-cols-2">
        <MonthlySchedule />
        <MonthCalendar />
      </div>
    </Card>
  );
}
