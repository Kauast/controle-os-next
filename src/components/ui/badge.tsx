import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
  Badge — Guardião Design System
  ─────────────────────────────────────────────────────────────────────────────
  Usado principalmente para status de OS e prioridade.
  Cada tom tem: fundo suave + texto de contraste AA + borda sutil.

  Tones:
    teal    → OS Concluída / online / sucesso
    amber   → OS Em andamento / atenção
    red     → OS Cancelada / crítico / offline
    blue    → OS Aberta / pendente
    orange  → OS Aguardando Peças
    neutral → tag genérica

  Sizes:
    sm  → 10px — tag compacta dentro de card
    md  → 11px — padrão (default)
    lg  → 12px — badge de destaque em cabeçalho

  Com ícone:
    Aceita children com ícone <svg> ou lucide — ícone herda size=3 via [&_svg]:size-3
*/

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1 rounded-[var(--radius-xs)] border",
    "font-semibold leading-none select-none",
    "[&_svg]:size-3 [&_svg]:shrink-0",
    // font-mono para leitura de dados (rule: number-tabular, label-eyebrow)
    "[font-family:var(--font-mono)]",
  ].join(" "),
  {
    variants: {
      tone: {
        teal:    "bg-[var(--color-teal-soft)]   text-teal   border-[var(--color-teal-border)]",
        amber:   "bg-[var(--color-amber-soft)]  text-amber  border-[var(--color-amber-border)]",
        red:     "bg-[var(--color-red-soft)]    text-[var(--color-red-bright)]   border-[var(--color-red-border)]",
        blue:    "bg-[var(--color-blue-soft)]   text-[var(--color-blue)]   border-[var(--color-blue-border)]",
        orange:  "bg-[var(--color-orange-soft)] text-[var(--color-orange)] border-[var(--color-orange-border)]",
        dark:    "bg-[var(--color-surface-0)] text-[var(--color-ink-secondary)] border-[var(--color-line)]",
        neutral: "bg-[var(--color-surface-2)] text-muted border-[var(--color-line)]",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[10px]",
        md: "px-2   py-1   text-[11px]",
        lg: "px-2.5 py-1   text-xs",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "md",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
