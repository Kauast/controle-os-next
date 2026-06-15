"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Clock, GripVertical, Plus } from "lucide-react";
import { SectionHeading } from "@/components/ui/card";
import { access } from "@/lib/access";
import { orderTone, sortOrders, toneBorder } from "@/lib/orders";
import { TEAMS } from "@/lib/types";
import { cn, userInitials } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import { useVisibleOrders } from "@/hooks/use-visible-orders";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useAssignServiceOrder } from "@/hooks/useServiceOrders";
import { useTeams } from "@/hooks/useTeams";
import { AssignModal } from "@/components/dashboard/assign-modal";
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
    className: "border-line text-muted",
  },
};

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  scheduled: "Agendada",
  completed: "Concluída",
};

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
        "group bg-panel rounded-sm border border-line border-l-[3px]",
        toneBorder[tone],
        "p-2.5 cursor-grab active:cursor-grabbing transition-shadow",
        isDragging ? "opacity-40" : "hover:shadow-sm hover:border-foreground/10",
      )}
    >
      <header className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-mono-tabular text-[10px] text-muted">
              {order.code}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted/50">
              · {statusLabel[order.status] ?? order.status}
            </span>
          </div>
          <h3 className="text-[12.5px] font-semibold leading-snug text-ink truncate">
            {order.client}
          </h3>
        </div>
        <GripVertical className="size-3 text-muted/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
      </header>

      <p className="text-[11px] text-muted leading-snug mb-2 line-clamp-1">
        {order.description}
      </p>

      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center px-1 py-px rounded-sm border text-[9px] font-semibold uppercase tracking-widest",
            prio.className,
          )}
        >
          {prio.label}
        </span>

        <div
          className={cn(
            "flex items-center gap-1 text-[10px] font-mono-tabular",
            late ? "text-status-critical" : "text-muted",
          )}
        >
          {late ? (
            <AlertTriangle className="size-2.5" strokeWidth={2} />
          ) : (
            <Clock className="size-2.5" strokeWidth={1.75} />
          )}
          <span>{order.time || "—"}</span>
        </div>
      </div>

      <footer className="mt-2 pt-2 border-t border-dashed border-line flex items-center gap-1.5">
        <div className="size-5 rounded-full bg-onyx text-silver grid place-items-center text-[8px] font-mono-tabular shrink-0">
          {userInitials(order.tech)}
        </div>
        <span className="text-[10px] text-muted truncate">
          {order.tech || "Não atribuído"}
        </span>
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
  const criticals = useMemo(() => orders.filter((o) => o.priority === "high").length, [orders]);

  return (
    <div className="flex flex-col min-w-[220px]">
      {/* Column header */}
      <header className="px-1 mb-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink">
            {title}
          </h2>
          <span className="font-mono-tabular text-[10px] text-muted">
            {String(orders.length).padStart(2, "0")}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          {subtitle && (
            <span className="text-[10px] text-muted truncate">{subtitle}</span>
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
          "flex-1 rounded-md p-1.5 space-y-1.5 transition-colors min-h-[120px]",
          isOver
            ? "bg-amber-soft ring-1 ring-amber/40 ring-inset"
            : "bg-panel-soft/40",
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
          <div className="h-16 grid place-items-center text-[10px] text-muted/50 uppercase tracking-widest border border-dashed border-line rounded-sm">
            {isEmpty ? "Arraste uma OS aqui" : "Sem OS"}
          </div>
        )}

        {showAddButton && (
          <button
            onClick={onAdd}
            className="w-full mt-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium text-muted hover:text-ink hover:bg-panel rounded-sm transition-colors border border-dashed border-transparent hover:border-line"
          >
            <Plus className="size-2.5" />
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
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, setPending] = useState<{ backendId: string; code: string; description: string; teamName: string } | null>(null);

  const technicianView = !access.seesAllOrders(role);
  const available = sortOrders(orders.filter((o) => o.team === "Sem equipe"));
  const { data: apiTeams = [] } = useTeams();
  const teamNames = apiTeams.map((t) => t.name);
  const teamsToShow = teamNames.length > 0 ? teamNames : TEAMS;
  const visibleTeams = technicianView ? (teamsToShow as string[]).filter((t) => t === activeTeam) : teamsToShow;

  const teamMembers = (teamName: string) => {
    const apiTeam = apiTeams.find((t) => t.name === teamName);
    if (apiTeam) return apiTeam.members.map((m) => m.name).join(", ");
    return technicians.filter((t) => t.team === teamName).map((t) => t.name).join(", ") || "Sem técnico";
  };

  function drop(teamName: string) {
    if (!dragBackendId || !dragCode) return;
    const order = orders.find((o) => o._backendId === dragBackendId);
    setPending({
      backendId: dragBackendId,
      code: dragCode,
      description: order?.description ?? "",
      teamName,
    });
    setDragCode(null);
    setDragBackendId(null);
    setOverTeam(null);
  }

  function confirmAssign(scheduledStart: string) {
    if (!pending) return;
    assignOrder.mutate(
      { id: pending.backendId, team: pending.teamName, scheduledStart },
      { onSuccess: () => setPending(null), onError: () => setPending(null) },
    );
  }

  function startDrag(code: string, backendId: string) {
    setDragCode(code);
    setDragBackendId(backendId);
  }

  return (
    <>
      <div className="rounded-lg border border-line bg-panel p-5 shadow-[var(--shadow-panel)]">
        {/* Header com data */}
        <div className="flex items-center justify-between mb-4">
          <SectionHeading eyebrow="Agenda das equipes" title="OS do dia e despacho" />
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDate((d) => {
                const dt = new Date(d); dt.setDate(dt.getDate() - 1); return dt.toISOString().slice(0, 10);
              })}
              className="px-2 py-1 text-[11px] text-muted border border-line rounded hover:bg-surface transition-colors"
            >
              ‹
            </button>
            <span className="text-[12px] text-muted font-mono min-w-[90px] text-center">
              {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
            </span>
            <button
              onClick={() => setDate((d) => {
                const dt = new Date(d); dt.setDate(dt.getDate() + 1); return dt.toISOString().slice(0, 10);
              })}
              className="px-2 py-1 text-[11px] text-muted border border-line rounded hover:bg-surface transition-colors"
            >
              ›
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          {/* Available OS column — fixed, does not scroll */}
          {!technicianView && (
            <div className="shrink-0 w-[220px]">
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
            </div>
          )}

          {/* Team columns — scroll horizontally */}
          <div className="flex-1 overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-max">
              {visibleTeams.map((team) => {
                const teamOrders = sortOrders(
                  orders.filter((o) => o.team === team && (!o.scheduledDate || o.scheduledDate === date))
                );
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
      </div>

      {pending && (
        <AssignModal
          osCode={pending.code}
          osDescription={pending.description}
          teamName={pending.teamName}
          onConfirm={confirmAssign}
          onCancel={() => setPending(null)}
          isPending={assignOrder.isPending}
        />
      )}
    </>
  );
}
