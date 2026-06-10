"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Card, SectionHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusTone } from "@/lib/constants";
import { useTeamLocations } from "@/hooks/useTeamLocations";

const teamColor = ["bg-teal", "bg-amber", "bg-[#6b5bd2]", "bg-[#2f8fd0]", "bg-red"];

export function TrackingPanel() {
  const { data: locations = [], isLoading, refresh } = useTeamLocations();
  const [active, setActive] = useState<string | null>(null);

  return (
    <Card>
      <SectionHeading eyebrow="Localizacao" title="Localizacao das equipes em campo">
        <div className="flex items-center gap-2">
          <Badge tone="teal">{locations.length} equipes</Badge>
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw /> Atualizar
          </Button>
        </div>
      </SectionHeading>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted">Carregando rastreamento...</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <section className="relative h-[240px] overflow-hidden rounded-[16px] border border-line bg-[linear-gradient(135deg,#eef2f4,#e3edeb)] sm:h-[360px]">
            <div className="absolute left-0 top-1/2 h-2 w-full -translate-y-1/2 bg-silver/40" />
            <div className="absolute left-1/3 top-0 h-full w-2 bg-silver/40" />
            <div className="absolute right-1/4 top-0 h-full w-1.5 bg-silver/30" />
            <div className="absolute left-4 top-4 rounded-[10px] bg-panel/80 px-3 py-2 backdrop-blur">
              <strong className="block text-xs text-ink">Mapa operacional</strong>
              <small className="text-[11px] text-muted">Posicoes baseadas no banco de dados</small>
            </div>
            {locations.map((l, i) => (
              <motion.button
                key={l.team}
                onClick={() => setActive(l.team)}
                animate={{ left: `${l.x}%`, top: `${l.y}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                style={{ left: `${l.x}%`, top: `${l.y}%` }}
              >
                <span
                  className={cn(
                    "size-4 rounded-full ring-4 ring-white",
                    teamColor[i % teamColor.length],
                    active === l.team && "scale-125",
                  )}
                />
                <span className="whitespace-nowrap rounded-full bg-panel/90 px-2 py-0.5 text-[10px] font-semibold text-ink shadow-sm">
                  {l.team} · {Math.round(l.speed)}km/h
                </span>
              </motion.button>
            ))}
          </section>

          <aside className="flex flex-col gap-2">
            {locations.map((l) => (
              <button
                key={l.team}
                onClick={() => setActive(l.team)}
                className={cn(
                  "rounded-[12px] border border-line bg-panel-soft/40 p-3 text-left transition-colors hover:border-teal/50",
                  active === l.team && "border-teal bg-teal-soft/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <strong className="text-sm text-ink">{l.team}</strong>
                  <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                </div>
                <span className="block text-xs text-muted">{l.members}</span>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted">Veiculo</span>
                    <strong className="block text-ink">{l.vehicle}</strong>
                  </div>
                  <div>
                    <span className="text-muted">OS atual</span>
                    <strong className="block text-ink">{l.currentOS}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Velocidade</span>
                    <strong className="block text-ink">{Math.round(l.speed)} km/h</strong>
                  </div>
                  <div>
                    <span className="text-muted">Ultimo sinal</span>
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
