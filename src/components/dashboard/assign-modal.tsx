"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 07..19

interface AssignModalProps {
  osCode: string;
  osDescription: string;
  teamName: string;
  onConfirm: (scheduledStart: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

function todayAt(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function AssignModal({
  osCode,
  osDescription,
  teamName,
  onConfirm,
  onCancel,
  isPending,
}: AssignModalProps) {
  const [hour, setHour] = useState(() => {
    const h = new Date().getHours();
    return Math.min(Math.max(h, 7), 19);
  });

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-72 bg-panel border border-line rounded-md shadow-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-[13px] font-semibold text-ink">
              Confirmar despacho
            </Dialog.Title>
            <button onClick={onCancel} className="text-muted hover:text-ink transition-colors">
              <X className="size-3.5" />
            </button>
          </div>

          <div className="space-y-2 text-[12px] mb-4">
            <Row label="OS" value={`${osCode} — ${osDescription}`} />
            <Row label="Equipe" value={teamName} />
          </div>

          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">
              Horário agendado
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {HOURS.map((h) => (
                <button
                  key={h}
                  onClick={() => setHour(h)}
                  className={cn(
                    "py-1.5 rounded-sm text-[11px] font-mono border transition-colors",
                    hour === h
                      ? "bg-accent text-white border-accent"
                      : "border-line text-muted hover:border-foreground/20 hover:text-ink",
                  )}
                >
                  {String(h).padStart(2, "0")}h
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-1.5 rounded border border-line text-[12px] text-muted hover:bg-surface transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(todayAt(hour))}
              disabled={isPending}
              className="flex-1 py-1.5 rounded bg-accent text-white text-[12px] font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {isPending ? "Despachando..." : "Despachar"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="text-muted shrink-0 w-12">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}
