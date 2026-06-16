import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
  Button — Guardião Design System
  ─────────────────────────────────────────────────────────────────────────────
  Touch targets:
    default  → h-11  (44px) — alvo mínimo WCAG 2.5.5
    sm       → h-10  (40px) — ação secundária contextual
    lg       → h-13  (52px) — botão primário de tela
    xl       → h-14  (56px) — CTA full-width (Finalizar OS, Check-in)
    icon     → 44×44px

  Variantes:
    primary   — teal sólido; ação principal
    secondary — borda sutil; ação secundária
    ghost     — sem borda; navegação
    danger    — vermelho; ação destrutiva
    amber     — âmbar sólido; logo / identidade visual (usado no login)
    icon      — quadrado, apenas ícone
    outline   — borda teal; ação confirmação

  Estados:
    hover    → brightness-110
    active   → scale-[0.97] + brightness-95
    disabled → opacity-45, cursor-not-allowed
    loading  → cursor-wait (use isLoading prop para adicionar spinner externo)

  Acessibilidade:
    focus-visible → outline teal com offset 2px (WCAG 2.4.11)
    disabled      → aria-disabled via pointer-events-none
*/

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold",
    "transition-all duration-[120ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
    "select-none touch-manipulation",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
    "disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed",
    "active:scale-[0.97]",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-teal text-black rounded-[var(--radius-sm)]",
          "hover:bg-teal-bright",
          "active:brightness-95",
          "focus-visible:ring-teal",
          "shadow-[var(--shadow-sm)]",
        ].join(" "),

        secondary: [
          "border border-[var(--color-line-strong)] bg-[var(--color-surface-3)] text-ink rounded-[var(--radius-sm)]",
          "hover:bg-[var(--color-surface-4)] hover:border-[var(--color-line-active)]",
          "active:brightness-90",
          "focus-visible:ring-[var(--color-teal)]",
        ].join(" "),

        ghost: [
          "text-muted rounded-[var(--radius-sm)]",
          "hover:bg-[var(--color-surface-3)] hover:text-ink",
          "focus-visible:ring-[var(--color-teal)]",
        ].join(" "),

        danger: [
          "bg-red text-white rounded-[var(--radius-sm)]",
          "hover:bg-[var(--color-red-bright)]",
          "active:brightness-90",
          "focus-visible:ring-red",
          "shadow-[var(--shadow-sm)]",
        ].join(" "),

        amber: [
          "bg-amber text-black rounded-[var(--radius-sm)]",
          "hover:bg-[var(--color-amber-bright)]",
          "active:brightness-90",
          "focus-visible:ring-amber",
          "shadow-[var(--shadow-sm)]",
        ].join(" "),

        outline: [
          "border border-[var(--color-teal-border)] bg-[var(--color-teal-soft)] text-teal rounded-[var(--radius-sm)]",
          "hover:bg-[var(--color-teal-medium)] hover:border-teal",
          "focus-visible:ring-[var(--color-teal)]",
        ].join(" "),

        icon: [
          "border border-[var(--color-line)] bg-[var(--color-surface-3)] text-muted rounded-[var(--radius-sm)]",
          "hover:text-ink hover:bg-[var(--color-surface-4)] hover:border-[var(--color-line-strong)]",
          "focus-visible:ring-[var(--color-teal)]",
        ].join(" "),
      },

      size: {
        sm:      "h-10 min-h-[40px] px-3 text-[13px]",
        default: "h-11 min-h-[44px] px-4 text-sm",
        lg:      "h-[52px] min-h-[52px] px-5 text-[15px]",
        xl:      "h-14 min-h-[56px] px-6 text-base",
        icon:    "h-11 w-11 min-h-[44px] min-w-[44px] p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Mostra estado de carregamento — desabilita interação e aplica cursor-wait */
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          isLoading && "cursor-wait opacity-70",
          className,
        )}
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
