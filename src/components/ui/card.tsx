import * as React from "react";
import { cn } from "@/lib/utils";

/*
  Card — Guardião Design System
  ─────────────────────────────────────────────────────────────────────────────
  Variantes:
    default   → surface-3 (#1F2937) — card padrão
    elevated  → surface-3 + shadow-float — card em destaque / modal inline
    subtle    → surface-2 (#1A2235) — card de segundo plano / seção interna
    ghost     → sem borda, sem fundo — agrupamento leve

  Estados semânticos (via prop tone):
    teal      → borda teal-border, fundo teal-soft  (concluído, sucesso)
    amber     → borda amber-border, fundo amber-soft (atenção, pendente)
    red       → borda red-border, fundo red-soft     (erro, crítico)
    blue      → borda blue-border, fundo blue-soft   (aberto)
    orange    → borda orange-border, fundo orange-soft (aguardando peças)

  SectionHeading: cabeçalho de seção com eyebrow + título + slot de ação.
*/

type CardTone = "default" | "teal" | "amber" | "red" | "blue" | "orange";
type CardVariant = "default" | "elevated" | "subtle" | "ghost";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  variant?: CardVariant;
}

const toneClasses: Record<CardTone, string> = {
  default: "border-[var(--color-line)] bg-[var(--color-surface-3)]",
  teal:    "border-[var(--color-teal-border)] bg-[var(--color-teal-soft)]",
  amber:   "border-[var(--color-amber-border)] bg-[var(--color-amber-soft)]",
  red:     "border-[var(--color-red-border)] bg-[var(--color-red-soft)]",
  blue:    "border-[var(--color-blue-border)] bg-[var(--color-blue-soft)]",
  orange:  "border-[var(--color-orange-border)] bg-[var(--color-orange-soft)]",
};

const variantClasses: Record<CardVariant, string> = {
  default:  "shadow-[var(--shadow-panel)]",
  elevated: "shadow-[var(--shadow-float)]",
  subtle:   "bg-[var(--color-surface-2)] border-[var(--color-line)] shadow-[var(--shadow-sm)]",
  ghost:    "border-transparent bg-transparent shadow-none",
};

function Card({ className, tone = "default", variant = "default", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border p-4",
        toneClasses[tone],
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

/*
  SectionHeading — título de seção no padrão eyebrow + h2 + slot de ação.
  Usado na tela principal do técnico acima de listas e painéis.
*/
function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <span className="label-eyebrow">{eyebrow}</span>
        <h2 className="mt-0.5 text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export { Card, SectionHeading };
