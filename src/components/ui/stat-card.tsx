"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/*
  StatCard — Guardião Design System
  ─────────────────────────────────────────────────────────────────────────────
  Card de métrica compacto usado no grid de estatísticas da tela do técnico.

  Visual:
    - Fundo surface-3 com borda semântica quando tone definido
    - Valor em destaque (text-3xl bold)
    - Label acima do valor
    - Hint abaixo do valor (suporte contextual)
    - Ícone no canto superior direito (opcional)

  Tones semânticos:
    alert   → red (OS críticas / offline)
    success → teal (concluídas / online)
    warn    → amber (pendentes / atenção)

  Entrada animada com framer-motion (delay por index).
  API mantida compatível com uso existente.
*/

interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
  alert?: boolean;
  success?: boolean;
  warn?: boolean;
  icon?: React.ReactNode;
  index?: number;
  className?: string;
}

export function StatCard({
  label,
  value,
  hint,
  alert,
  success,
  warn,
  icon,
  index = 0,
  className,
}: StatCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.06,
        duration: 0.22,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-md)] border p-4",
        "shadow-[var(--shadow-panel)]",
        /* default */
        !alert && !success && !warn && "border-[var(--color-line)] bg-[var(--color-surface-3)]",
        /* semântico */
        alert   && "border-[var(--color-red-border)]   bg-[var(--color-red-soft)]",
        success && "border-[var(--color-teal-border)]  bg-[var(--color-teal-soft)]",
        warn    && "border-[var(--color-amber-border)] bg-[var(--color-amber-soft)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted leading-relaxed">
          {label}
        </span>
        {icon && (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-xs)] border",
              "[&_svg]:size-3.5",
              !alert && !success && !warn && "border-[var(--color-line)] text-muted",
              alert   && "border-[var(--color-red-border)]   text-[var(--color-red-bright)]",
              success && "border-[var(--color-teal-border)]  text-teal",
              warn    && "border-[var(--color-amber-border)] text-amber",
            )}
          >
            {icon}
          </span>
        )}
      </div>

      <strong
        className={cn(
          "mt-1.5 block text-[28px] font-bold leading-none tracking-tight",
          !alert && !success && !warn && "text-ink",
          alert   && "text-[var(--color-red-bright)]",
          success && "text-teal",
          warn    && "text-amber",
        )}
      >
        {value}
      </strong>

      {hint && (
        <small className="mt-1.5 block text-[11px] leading-relaxed text-muted">
          {hint}
        </small>
      )}
    </motion.article>
  );
}
