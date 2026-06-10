"use client";

import { useState } from "react";
import { AlertTriangle, Clock, GripVertical, Plus } from "lucide-react";
import { SectionHeading } from "@/components/ui/card";
import { access } from "@/lib/access";
import { orderTone, sortOrders, toneBorder } from "@/lib/orders";
import { TEAMS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import { useVisibleOrders } from "@/hooks/use-visible-orders";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useAssignServiceOrder } from "@/hooks/useServiceOrders";
import type { ServiceOrder } from "@/lib/types";

/* ── helpers ── */

const priorityMeta: Record<string, { label: string; className: string }> = {
  high: {
    label: "Alta",
    className: "border-status-critical/40 text-status-critical bg-status-critical/5",
  },
  warning: {
    label: "Pendente",
    className: "border-amber/40 text-amber bg-amber-soft",
  },
  normal: {
    label: "Normal",
    className: "border-border text-muted-foreground",
  },
};

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  scheduled: "Agendada",
  completed: "Concluída",
};

function techInitials(name: string): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/* ── OSCard ── */

function OSCard({
  order,
  isDragging,
}: {
  order: ServiceOrder;
  isDragging?: boolean;
}) {
  const tone = orderTone(order);
  const prio = priorityMeta[order.priority] ?? priorityMeta.normal;
  const late = order.status !== "completed" && order.priority === "high";

  return (
    <article
      draggable
      className={cn(
        "group bg-card rounded-md border border-border border-l-[3px]",
        toneBorder[tone],
        "p-3.5 cursor-grab active:cursor-grabbing transition-shadow",
        isDragging ? "opacity-40" : "hover:shadow-sm hover:border-foreground/10",
      )}
    >
      <header className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono-tabular text-[11px] text-muted-foreground">
              {order.code}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              · {statusLabel[order.status] ?? order.status}
            </span>
          </div>
          <h3 className="text-[13.5px] font-semibold leading-snug text-foreground mt-0.5 truncate">
            {order.client}
          </h3>
        </div>
        <GripVertical className="size-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </header>

      <p className="text-[12px] text-muted-foreground leading-snug mb-3 line-clamp-2">
        {order.description}
      </p>

      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[9px] font-semibold uppercase tracking-widest",
            prio.className,
          )}
        >
          {prio.label}
        </span>

        <div
          className={cn(
            "flex items-center gap-1 text-[10.5px] font-mono-tabular",
            late ? "text-status-critical" : "text-muted-foreground",
          )}
        >
          {late ? (
            <AlertTriangle className="size-3" strokeWidth={2} />
          ) : (
            <Clock className="size-3" strokeWidth={1.75} />
          )}
          <span>{order.time || "—"}</span>
        </div>
      </div>

      <footer className="mt-3 pt-3 border-t border-dashed border-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-6 rounded-full bg-onyx text-silver grid place-items-center text-[9px] font-mono-tabular shrink-0">
            {techInitials(order.tech)}
          </div>
          <span className="text-[11px] text-foreground/70 truncate">
            {order.tech || "Não atribuído"}
          </span>
        </div>
      </footer>
    </article>
  );
}

/* ── KanbanColumn ── */

function KanbanColumn({
  title,
  subtitle,
  orders,
  isOver,
  isEmpty,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  dragCode,
  showAddButton,
  onAdd,
}: {
  title: string;
  subtitle?: string;
  orders: ServiceOrder[];
  isOver: boolean;
  isEmpty?: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragStart: (code: string, backendId: string) => void;
  dragCode: string | null;
  showAddButton?: boolean;
  onAdd?: () => void;
}) {
  const criticals = orders.filter((o) => o.priority === "high").length;

  return (
    <div className="flex flex-col min-w-[260px]">
      {/* Column header */}
      <header className="px-1 mb-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground">
            {title}
          </h2>
          <span className="font-mono-tabular text-[11px] text-muted-foreground">
            {String(orders.length).padStart(2, "0")}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          {subtitle && (
            <span className="text-[11px] text-muted-foreground truncate">{subtitle}</span>
          )}
          {criticals > 0 && (
            <span className="text-[9px] font-semibold uppercase tracking-widest text-status-critical ml-auto">
              {criticals} crítica{criticals > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </header>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "flex-1 rounded-md p-2 space-y-2 transition-colors min-h-[160px]",
          isOver
            ? "bg-amber-soft ring-1 ring-amber/40 ring-inset"
            : "bg-muted/40",
        )}
      >
        {orders.map((o) => (
          <div
            key={o.code}
            onDragStart={(e) => {
              e.stopPropagation();
              onDragStart(o.code, o._backendId ?? o.code);
            }}
          >
            <OSCard order={o} isDragging={dragCode === o.code} />
          </div>
        ))}

        {orders.length === 0 && (
          <div className="h-24 grid place-items-center text-[11px] text-muted-foreground/50 uppercase tracking-widest border border-dashed border-border rounded-sm">
            {isEmpty ? "Arraste uma OS aqui" : "Sem OS"}
          </div>
        )}

        {showAddButton && (
          <button
            onClick={onAdd}
            className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-card rounded-sm transition-colors border border-dashed border-transparent hover:border-border"
          >
            <Plus className="size-3" />
            Adicionar OS
          </button>
        )}
      </div>
    </div>
  );
}

/* ── DispatchBoard ── */

export function DispatchBoard() {
  const role = useAppStore((s) => s.role);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const { data: technicians = [] } = useTechnicians();
  const orders = useVisibleOrders();
  const assignOrder = useAssignServiceOrder();
  const [dragCode, setDragCode] = useState<string | null>(null);
  const [dragBackendId, setDragBackendId] = useState<string | null>(null);
  const [overTeam, setOverTeam] = useState<string | null>(null);

  const technicianView = !access.seesAllOrders(role);
  const available = sortOrders(orders.filter((o) => o.team === "Sem equipe"));
  const visibleTeams = technicianView ? TEAMS.filter((t) => t === activeTeam) : TEAMS;

  const teamMembers = (team: string) =>
    technicians.filter((t) => t.team === team).map((t) => t.name).join(", ") || "Sem tecnico";

  function drop(team: string) {
    if (dragBackendId) assignOrder.mutate({ id: dragBackendId, team });
    setDragCode(null);
    setDragBackendId(null);
    setOverTeam(null);
  }

  function startDrag(code: string, backendId: string) {
    setDragCode(code);
    setDragBackendId(backendId);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-panel)]">
      <SectionHeading eyebrow="Agenda das equipes" title="OS do dia e despacho" />

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          {/* Available OS column */}
          {!technicianView && (
            <KanbanColumn
              title="Disponíveis"
              subtitle="Arraste para uma equipe"
              orders={available}
              isOver={overTeam === "Sem equipe"}
              isEmpty
              onDragOver={(e) => { e.preventDefault(); setOverTeam("Sem equipe"); }}
              onDragLeave={() => setOverTeam((t) => (t === "Sem equipe" ? null : t))}
              onDrop={() => drop("Sem equipe")}
              onDragStart={startDrag}
              dragCode={dragCode}
            />
          )}

          {/* Team columns */}
          {visibleTeams.map((team) => {
            const teamOrders = sortOrders(orders.filter((o) => o.team === team));
            return (
              <KanbanColumn
                key={team}
                title={team}
                subtitle={teamMembers(team)}
                orders={teamOrders}
                isOver={overTeam === team}
                isEmpty
                onDragOver={(e) => { e.preventDefault(); setOverTeam(team); }}
                onDragLeave={() => setOverTeam((t) => (t === team ? null : t))}
                onDrop={() => drop(team)}
                onDragStart={startDrag}
                dragCode={dragCode}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
