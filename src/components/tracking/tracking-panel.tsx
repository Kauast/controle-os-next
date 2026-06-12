"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Card, SectionHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { statusTone } from "@/lib/constants";
import { useTeamLocations } from "@/hooks/useTeamLocations";

const teamColor = [
  "bg-teal",
  "bg-amber",
  "bg-[#6b5bd2]",
  "bg-[#2f8fd0]",
  "bg-red",
];

function statusIcon(status: string) {
  const s = status.toLowerCase();
  if (s.includes("offline")) return <WifiOff className="size-3" />;
  return <Wifi className="size-3" />;
}

export function TrackingPanel() {
  const { data: locations = [], isLoading, refresh } = useTeamLocations();
  const [active, setActive] = useState<string | null>(null);

  const online      = locations.filter((l) => !l.status.toLowerCase().includes("offline")).length;
  const offline     = locations.length - online;

  return (
    <Card>
      <SectionHeading eyebrow="Equipes em campo" title="Localização">
        <div className="flex items-center gap-2">
          {online > 0 && <Badge tone="teal">{online} online</Badge>}
          {offline > 0 && <Badge tone="red">{offline} offline</Badge>}
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            aria-label="Atualizar localização das equipes"
          >
            <RefreshCw className="size-3.5" />
            Atualizar
          </Button>
        </div>
      </SectionHeading>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="h-[360px] animate-pulse rounded-[16px] bg-panel" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-[12px] bg-panel" />
            ))}
          </div>
        </div>
      ) : locations.length === 0 ? (
        <EmptyState
          icon={<MapPin className="size-6" />}
          title="Nenhuma equipe em campo agora"
          description="Quando equipes iniciarem deslocamento, suas posições aparecerão aqui."
          action={
            <Button variant="secondary" size="sm" onClick={refresh}>
              <RefreshCw className="size-3.5" /> Verificar novamente
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          {/* Map */}
          <section
            className="relative overflow-hidden rounded-[16px] border border-line bg-[linear-gradient(135deg,#0f2235,#0d1b2a)] h-[260px] sm:h-[380px]"
            aria-label="Mapa de localização das equipes"
          >
            {/* Grid lines */}
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: "linear-gradient(rgba(20,184,166,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(20,184,166,0.3) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />

            <div className="absolute left-4 top-4 rounded-[10px] border border-line bg-panel/80 px-3 py-2 backdrop-blur-sm">
              <strong className="block text-xs text-ink">Mapa operacional</strong>
              <small className="text-[11px] text-muted">Posições em tempo real</small>
            </div>

            {locations.map((l, i) => (
              <motion.button
                key={l.team}
                onClick={() => setActive((a) => (a === l.team ? null : l.team))}
                animate={{ left: `${l.x}%`, top: `${l.y}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                style={{ left: `${l.x}%`, top: `${l.y}%` }}
                aria-label={`Equipe ${l.team}`}
              >
                <span
                  className={cn(
                    "size-5 rounded-full ring-2 ring-white/30 transition-transform",
                    teamColor[i % teamColor.length],
                    active === l.team && "scale-150 ring-white/60",
                  )}
                />
                <span className="whitespace-nowrap rounded-full bg-panel/90 px-2 py-0.5 text-[10px] font-semibold text-ink shadow-sm backdrop-blur-sm">
                  {l.team}
                  {l.speed > 0 && ` · ${Math.round(l.speed)}km/h`}
                </span>
              </motion.button>
            ))}
          </section>

          {/* Sidebar */}
          <aside className="flex flex-col gap-2" aria-label="Lista de equipes em campo">
            {locations.map((l) => (
              <button
                key={l.team}
                onClick={() => setActive((a) => (a === l.team ? null : l.team))}
                className={cn(
                  "rounded-[12px] border border-line bg-panel-soft/40 p-3 text-left transition-all hover:border-teal/40",
                  active === l.team && "border-teal bg-teal-soft/30",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm font-semibold text-ink">{l.team}</strong>
                  <Badge tone={statusTone(l.status)}>
                    <span className="flex items-center gap-1">
                      {statusIcon(l.status)}
                      {l.status}
                    </span>
                  </Badge>
                </div>

                {(l as { members?: string }).members && (
                  <span className="mt-0.5 block text-xs text-muted">{(l as { members?: string }).members}</span>
                )}

                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div>
                    <span className="text-muted">Veículo</span>
                    <strong className="block text-ink">{l.vehicle || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted">OS atual</span>
                    <strong className="block text-ink">{(l as { currentOS?: string }).currentOS || "—"}</strong>
                  </div>
                  {l.speed > 0 && (
                    <div>
                      <span className="text-muted">Velocidade</span>
                      <strong className="block text-ink">{Math.round(l.speed)} km/h</strong>
                    </div>
                  )}
                  <div>
                    <span className="text-muted">Último sinal</span>
                    <strong className="block text-ink">{l.updated}</strong>
                  </div>
                </div>
              </button>
            ))}
          </aside>
        </div>
      )}
    </Card>
  );
}
