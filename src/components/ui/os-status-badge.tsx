"use client";

import { Circle, Clock, AlertCircle, CheckCircle2, XCircle, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

export type OsStatus =
  | "ABERTA"
  | "EM_ANDAMENTO"
  | "AGUARDANDO_PECAS"
  | "CONCLUIDA"
  | "CANCELADA";

interface StatusConfig {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  className: string;
}

const statusMap: Record<OsStatus, StatusConfig> = {
  ABERTA: {
    label: "Aberta",
    Icon: Circle,
    className: "status-open",
  },
  EM_ANDAMENTO: {
    label: "Em andamento",
    Icon: Clock,
    className: "status-in-progress",
  },
  AGUARDANDO_PECAS: {
    label: "Aguardando peças",
    Icon: Pause,
    className: "status-waiting-parts",
  },
  CONCLUIDA: {
    label: "Concluída",
    Icon: CheckCircle2,
    className: "status-completed",
  },
  CANCELADA: {
    label: "Cancelada",
    Icon: XCircle,
    className: "status-cancelled",
  },
};

interface OsStatusBadgeProps {
  status: OsStatus;
  size?: "sm" | "md";
  className?: string;
}

export function OsStatusBadge({ status, size = "md", className }: OsStatusBadgeProps) {
  const config = statusMap[status] ?? {
    label: status,
    Icon: AlertCircle,
    className: "status-open",
  };

  const { label, Icon } = config;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] border px-2",
        size === "sm" ? "py-0.5 text-[10px]" : "py-1 text-[11px]",
        config.className,
        className,
      )}
      style={{ fontFamily: "var(--font-mono)", fontWeight: 500, letterSpacing: "0.06em" }}
      aria-label={`Status: ${label}`}
    >
      <Icon className={cn("shrink-0", size === "sm" ? "size-2.5" : "size-3")} aria-hidden />
      {label}
    </span>
  );
}
