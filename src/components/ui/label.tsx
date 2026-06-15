"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

/*
  Label — Guardião Design System
  ─────────────────────────────────────────────────────────────────────────────
  Usado acima de inputs e selects.
  - text-[13px] font-medium para legibilidade ao ar livre
  - gap-2 entre label e control (antes era 1.5)
  - Cor ink-secondary (#C8CDD8) — mais legível que muted em campo
  - API mantida: aceita filhos diretos como controle associado
*/

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "flex flex-col gap-2 text-[13px] font-medium text-[var(--color-ink-secondary)]",
      "[&>*]:font-normal",
      className,
    )}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
