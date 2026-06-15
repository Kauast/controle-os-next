"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, Trash2 } from "lucide-react";

/*
  SignaturePad — Guardião (redesign Fase 1)
  ─────────────────────────────────────────────────────────────────────────────
  Canvas de assinatura do cliente.
  - Altura aumentada para 160px (conforto de assinatura ao ar livre)
  - Fundo branco puro para a tela de assinatura (contraste da tinta escura)
  - Borda tracejada sutil indica área de desenho
  - Estado "Confirmada" exibe preview + badge teal
  - Estado "Pendente" exibe instrução textual
  - Botões: Limpar (secondary) + Confirmar (primary, só ativo com ink)
  - API pública mantida: { value, onConfirm, onClear }
*/

export function SignaturePad({
  value,
  onConfirm,
  onClear,
}: {
  value: string | null;
  onConfirm: (dataUrl: string) => void;
  onClear: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    /* estilo da caneta */
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = "#111827";   /* tinta escura sobre fundo branco */
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
      setHasInk(true);
    }
  }, [value]);

  function point(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function down(e: React.PointerEvent) {
    drawing.current = true;
    last.current = point(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setHasInk(true);
  }

  function up() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onClear();
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line-strong)] bg-[var(--color-surface-3)] overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-line)]">
        <span className="text-[13px] font-medium text-muted">Assinatura do cliente</span>
        {value ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal">
            <CheckCircle2 className="size-3.5" />
            Confirmada
          </span>
        ) : (
          <span className="text-[11px] text-[var(--color-disabled)]">Pendente</span>
        )}
      </div>

      {/* Área de desenho — fundo branco para a caneta escura */}
      <div className="relative mx-3 my-3">
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          className={cn(
            "h-44 w-full touch-none rounded-[var(--radius-sm)]",
            "border-2 border-dashed",
            "bg-white",                            /* contraste da tinta */
            hasInk || value
              ? "border-[var(--color-teal-border)]"
              : "border-[rgba(0,0,0,0.15)]",
          )}
          style={{ cursor: "crosshair" }}
        />
        {/* Instrução quando vazio */}
        {!hasInk && !value && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-[rgba(0,0,0,0.30)]">
            Peça ao cliente para assinar aqui
          </p>
        )}
      </div>

      {/* Ações */}
      <div className="flex gap-2 px-3 pb-3">
        <Button
          type="button"
          variant="secondary"
          size="default"
          className="flex-1"
          onClick={clear}
          disabled={!hasInk && !value}
        >
          <Trash2 className="size-4" />
          Limpar
        </Button>
        <Button
          type="button"
          variant="primary"
          size="default"
          className="flex-1"
          disabled={!hasInk}
          onClick={() => onConfirm(canvasRef.current!.toDataURL("image/png"))}
        >
          <CheckCircle2 className="size-4" />
          Confirmar
        </Button>
      </div>
    </div>
  );
}
