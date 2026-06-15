import * as React from "react";
import { cn } from "@/lib/utils";

/*
  Input / Textarea — Guardião Design System
  ─────────────────────────────────────────────────────────────────────────────
  Touch target mínimo: h-12 (48px) — confortável para uso ao ar livre com luvas.

  Estados:
    default      → borda line, fundo surface-3
    hover        → borda line-strong
    focus        → borda teal + ring teal/25 + outline none
    error        → borda red-border + ring red/20
    disabled     → opacity-45, cursor-not-allowed

  Variante error:
    Adicione className="input-error" ou use a prop error para estado de erro.

  Nota: text-base (16px) previne zoom automático do iOS/Android ao focar.
*/

const inputBase = [
  "flex w-full rounded-[var(--radius-sm)] border bg-[var(--color-surface-3)]",
  "px-4 text-[15px] text-ink",                   /* 15px = text-base mobile */
  "placeholder:text-[var(--color-disabled)]",
  "transition-colors duration-[120ms]",
  "border-[var(--color-line-strong)]",
  "hover:border-[var(--color-line-active)]",
  "focus-visible:outline-none",
  "focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-[var(--color-teal-soft)]",
  "disabled:cursor-not-allowed disabled:opacity-45",
  "shadow-[var(--shadow-sm)]",
].join(" ");

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }
>(({ className, type, error, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        inputBase,
        "h-12 min-h-[48px] py-2",    /* touch target ≥ 44px, conforto em 48px */
        error && "border-[var(--color-red-border)] focus-visible:ring-[var(--color-red-soft)] focus-visible:border-red",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }
>(({ className, error, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        inputBase,
        "min-h-[96px] py-3 resize-none leading-relaxed",
        error && "border-[var(--color-red-border)] focus-visible:ring-[var(--color-red-soft)] focus-visible:border-red",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Input, Textarea };
