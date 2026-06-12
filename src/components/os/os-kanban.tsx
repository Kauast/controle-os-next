"use client";

import { useState, useMemo } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  User,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { useServiceOrders, useUpdateServiceOrderStatus } from "@/hooks/useServiceOrders";
import type { ServiceOrder as ApiServiceOrder } from "@/hooks/useServiceOrders";
import { useUIStore } from "@/store/use-ui-store";
import { useAppStore } from "@/store/use-app-store";
import { access } from "@/lib/access";

/* ── helpers ── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (mins > 0) return `${mins}min`;
  return "agora";
}

function formatCurrencyShort(value: number): string {
  if (!value) return "—";
  if (value >= 1000) return `R$${(value / 1000).toFixed(1)}k`;
  return `R$${value.toFixed(0)}`;
}

/* ── column config ── */

interface KanbanColumn {
  status: string;
  label: string;
  accent: string;
  icon: React.ReactNode;
  emptyLabel: string;
}

const COLUMNS: KanbanColumn[] = [
  {
    status: "OPEN",
    label: "Nova",
    accent: "bg-blue-500",
    icon: <ClipboardList className="size-3.5" />,
    emptyLabel: "Nenhuma OS nova.",
  },
  {
    status: "SCHEDULED",
    label: "Agendada",
    accent: "bg-amber",
    icon: <Calendar className="size-3.5" />,
    emptyLabel: "Nenhuma OS agendada.",
  },
  {
    status: "IN_PROGRESS",
    label: "Em Execução",
    accent: "bg-teal",
    icon: <Clock className="size-3.5" />,
    emptyLabel: "Nenhuma OS em execução.",
  },
  {
    status: "WAITING_PARTS",
    label: "Aguardando Material",
    accent: "bg-orange-400",
    icon: <AlertTriangle className="size-3.5" />,
    emptyLabel: "Nenhuma OS aguardando material.",
  },
  {
    status: "COMPLETED",
    label: "Concluída",
    accent: "bg-success",
    icon: <CheckCircle2 className="size-3.5" />,
    emptyLabel: "Nenhuma OS concluída ainda.",
  },
  {
    status: "CANCELLED",
    label: "Cancelada",
    accent: "bg-silver",
    icon: <XCircle className="size-3.5" />,
    emptyLabel: "Nenhuma OS cancelada.",
  },
];

const PRIORITY_BADGE: Record<string, { tone: "red" | "amber" | "neutral"; label: string }> = {
  HIGH:    { tone: "red",     label: "Alta" },
  WARNING: { tone: "amber",   label: "Média" },
  NORMAL:  { tone: "neutral", label: "Normal" },
};

/* ── OS Card ── */

function OsCard({
  order,
  isDragging,
}: {
  order: ApiServiceOrder;
  isDragging: boolean;
}) {
  const prio = PRIORITY_BADGE[order.priority] ?? PRIORITY_BADGE.NORMAL;
  const clientName = typeof order.client === "object" ? order.client.name : String(order.client ?? "");
  const techName   = order.technician ? order.technician.name : null;
  const number     = `OS-${String(order.number).padStart(4, "0")}`;

  return (
    <article
      draggable
      className={cn(
        "group flex flex-col gap-2 rounded-[12px] border border-line bg-panel p-3 cursor-grab active:cursor-grabbing transition-all",
        isDragging ? "opacity-40 scale-95" : "hover:border-teal/30 hover:shadow-md",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-mono text-[10px] font-semibold text-muted">{number}</span>
          <h3 className="mt-0.5 truncate text-[13px] font-semibold leading-snug text-ink">
            {clientName}
          </h3>
        </div>
        <Badge tone={prio.tone} className="shrink-0 text-[9px]">{prio.label}</Badge>
      </header>

      {order.description && (
        <p className="line-clamp-2 text-[11px] leading-relaxed text-muted">{order.description}</p>
      )}

      <footer className="mt-1 flex items-center justify-between gap-2 border-t border-line pt-2 text-[10px] text-muted">
        <div className="flex items-center gap-1 min-w-0">
          <User className="size-3 shrink-0" />
          <span className="truncate">{techName ?? "Sem técnico"}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {order.totalAmount > 0 && (
            <span className="font-semibold text-teal">{formatCurrencyShort(order.totalAmount)}</span>
          )}
          <span className="tabular-nums">{timeAgo(order.createdAt)}</span>
        </div>
      </footer>
    </article>
  );
}

/* ── Kanban Column ── */

function Column({
  col,
  orders,
  dragId,
  overStatus,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  col: KanbanColumn;
  orders: ApiServiceOrder[];
  dragId: string | null;
  overStatus: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, status: string) => void;
  onDragLeave: () => void;
  onDrop: (status: string) => void;
}) {
  const isOver = overStatus === col.status;

  return (
    <div className="flex min-w-[220px] max-w-[240px] flex-col gap-2 shrink-0">
      <header className="flex items-center justify-between gap-1 px-0.5">
        <div className="flex items-center gap-1.5">
          <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-sm text-black", col.accent)}>
            {col.icon}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink">
            {col.label}
          </span>
        </div>
        <span className="min-w-[24px] rounded-full bg-panel px-1.5 py-px text-center text-[10px] font-semibold tabular-nums text-muted">
          {orders.length}
        </span>
      </header>

      <div
        onDragOver={(e) => onDragOver(e, col.status)}
        onDragLeave={onDragLeave}
        onDrop={() => onDrop(col.status)}
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-[14px] p-2 transition-colors min-h-[200px]",
          isOver ? "bg-teal-soft ring-1 ring-teal/30 ring-inset" : "bg-panel-soft/40",
        )}
      >
        {orders.map((o) => (
          <div
            key={o.id}
            onDragStart={() => onDragStart(o.id)}
          >
            <OsCard order={o} isDragging={dragId === o.id} />
          </div>
        ))}

        {orders.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-[10px] border border-dashed border-line py-8">
            <p className="px-3 text-center text-[10px] text-muted">{col.emptyLabel}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── OsKanban ── */

export function OsKanban() {
  const role = useAppStore((s) => s.role);
  const setNewOsOpen = useUIStore((s) => s.setNewOsOpen);

  const { data: osData, isLoading } = useServiceOrders({ limit: 200 });
  const updateStatus = useUpdateServiceOrderStatus();

  const [dragId, setDragId]   = useState<string | null>(null);
  const [overStatus, setOver] = useState<string | null>(null);

  const [filterPriority, setFilterPriority] = useState("all");
  const [filterTeam, setFilterTeam]         = useState("all");

  const apiOrders = useMemo(() => osData?.serviceOrders ?? [], [osData]);

  const filtered = useMemo(() => {
    return apiOrders.filter((o) => {
      if (filterPriority !== "all" && o.priority !== filterPriority) return false;
      if (filterTeam !== "all" && o.team !== filterTeam) return false;
      return true;
    });
  }, [apiOrders, filterPriority, filterTeam]);

  const teams = useMemo(() => {
    return Array.from(new Set(apiOrders.map((o) => o.team).filter(Boolean)));
  }, [apiOrders]);

  function handleDrop(toStatus: string) {
    if (dragId && toStatus) {
      updateStatus.mutate({ id: dragId, status: toStatus });
    }
    setDragId(null);
    setOver(null);
  }

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <div key={col.status} className="flex min-w-[220px] flex-col gap-2 shrink-0">
            <div className="h-5 w-24 animate-pulse rounded-full bg-panel" />
            <div className="h-[300px] animate-pulse rounded-[14px] bg-panel" />
          </div>
        ))}
      </div>
    );
  }

  if (apiOrders.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="size-6" />}
        title="Nenhuma ordem de serviço"
        description="Crie a primeira OS para começar a operar."
        action={
          access.canCreateOS(role) ? (
            <button
              onClick={() => setNewOsOpen(true)}
              className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
            >
              Nova OS
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="h-8 rounded-xl border border-line bg-panel px-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-teal/40"
          aria-label="Filtrar por prioridade"
        >
          <option value="all">Todas as prioridades</option>
          <option value="HIGH">Alta</option>
          <option value="WARNING">Média</option>
          <option value="NORMAL">Normal</option>
        </select>

        {teams.length > 1 && (
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="h-8 rounded-xl border border-line bg-panel px-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-teal/40"
            aria-label="Filtrar por equipe"
          >
            <option value="all">Todas as equipes</option>
            {teams.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        <span className="ml-auto text-xs text-muted">{filtered.length} OS</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colOrders = filtered.filter((o) => o.status === col.status);
          return (
            <Column
              key={col.status}
              col={col}
              orders={colOrders}
              dragId={dragId}
              overStatus={overStatus}
              onDragStart={(id) => setDragId(id)}
              onDragOver={(e, s) => { e.preventDefault(); setOver(s); }}
              onDragLeave={() => setOver((cur) => cur === col.status ? null : cur)}
              onDrop={handleDrop}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted">
        <Eye className="size-3" />
        Arraste os cards para mover entre colunas
      </div>
    </div>
  );
}
