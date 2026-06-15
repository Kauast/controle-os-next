import * as React from "react";
import { cn } from "@/lib/utils";

/*
  EmptyState — Guardião Design System
  ─────────────────────────────────────────────────────────────────────────────
  Usado quando:
    - Nenhuma OS atribuída ao técnico
    - Lista de OS vazia após filtro
    - Erro de carregamento (com action de retry)

  Variantes visuais (via tone):
    neutral  → ícone cinza  (lista vazia padrão)
    success  → ícone teal   (dia concluído / tudo ok)
    warn     → ícone amber  (atenção necessária)
    error    → ícone red    (falha de carregamento)

  API mantida compatível com uso existente.
*/

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  tone?: "neutral" | "success" | "warn" | "error";
}

const iconTone: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  neutral: "border-[var(--color-line-strong)] bg-[var(--color-surface-2)] text-muted",
  success: "border-[var(--color-teal-border)] bg-[var(--color-teal-soft)] text-teal",
  warn:    "border-[var(--color-amber-border)] bg-[var(--color-amber-soft)] text-amber",
  error:   "border-[var(--color-red-border)] bg-[var(--color-red-soft)] text-[var(--color-red-bright)]",
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  tone = "neutral",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            "flex size-16 items-center justify-center rounded-[var(--radius-md)] border",
            "[&_svg]:size-7",
            iconTone[tone],
          )}
        >
          {icon}
        </div>
      )}
      <div className="max-w-[260px] space-y-1.5">
        <p className="text-[15px] font-semibold text-ink leading-snug">{title}</p>
        {description && (
          <p className="text-[13px] leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
