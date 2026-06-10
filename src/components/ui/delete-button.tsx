"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";

interface DeleteButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  onConfirm: () => void;
  /** ms before auto-reset back to idle (default 3000) */
  timeout?: number;
  /** icon-only mode for tight spaces (e.g. table rows) */
  compact?: boolean;
  children?: React.ReactNode;
}

export function DeleteButton({
  onConfirm,
  timeout = 3000,
  compact = false,
  disabled,
  children,
  className,
  size = "sm",
  ...props
}: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function request() {
    setConfirming(true);
    timerRef.current = setTimeout(() => setConfirming(false), timeout);
  }

  function cancel() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
  }

  function confirm() {
    cancel();
    onConfirm();
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  /* ── Compact (icon-only) ── */
  if (compact) {
    if (!confirming) {
      return (
        <button
          type="button"
          onClick={request}
          disabled={disabled}
          title="Remover"
          className={cn(
            "rounded p-0.5 text-muted hover:text-red transition-colors disabled:pointer-events-none disabled:opacity-50",
            className,
          )}
        >
          <Trash2 className="size-3" />
        </button>
      );
    }
    return (
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={confirm}
          title="Confirmar exclusão"
          className="rounded p-0.5 text-red hover:bg-red/10 transition-colors"
        >
          <Check className="size-3" />
        </button>
        <button
          type="button"
          onClick={cancel}
          title="Cancelar"
          className="rounded p-0.5 text-muted hover:text-ink transition-colors"
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  /* ── Full button ── */
  if (!confirming) {
    return (
      <Button
        type="button"
        variant="danger"
        size={size}
        disabled={disabled}
        onClick={request}
        className={className}
        {...props}
      >
        {children ?? (
          <>
            <Trash2 />
            Excluir
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button type="button" variant="danger" size={size} onClick={confirm}>
        <Check />
        Confirmar
      </Button>
      <Button type="button" variant="secondary" size={size} onClick={cancel}>
        Cancelar
      </Button>
    </div>
  );
}
