"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Card, SectionHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { access } from "@/lib/access";
import { sortOrders } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import { statusTone } from "@/lib/constants";

const teamColor = ["bg-teal", "bg-amber", "bg-[#6b5bd2]", "bg-[#2f8fd0]", "bg-red"];

export function TrackingPanel() {
  const role = useAppStore((s) => s.role);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const locations = useAppStore((s) => s.locations);
  const technicians = useAppStore((s) => s.technicians);
  const orders = useAppStore((s) => s.orders);
  const refresh = useAppStore((s) => s.refreshLocations);
  const [active, setActive] = useState(activeTeam);

  const visible = access.seesAllOrders(role)
    ? locations
    : locations.filter((l) => l.team === activeTeam);

  const members = (team: string) =>
    technicians.filter((t) => t.team === team).map((t) => t.name).join(", ") || "Sem tecnico";
  const currentOrder = (team: string) =>
    sortOrders(orders.filter((o) => o.team === team && o.status !== "completed"))[0]?.code ?? "Sem OS";
  const status = (team: string, fallback: string) =>
    technicians.find((t) => t.team === team && t.status !== "Disponivel")?.status ?? fallback;

  return (
    <Card>
      <SectionHeading eyebrow="Localizacao" title="Localizacao das equipes em campo">
        <div className="flex items-center gap-2">
          <Badge tone="teal">{visible.length} equipes</Badge>
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw /> Atualizar
          </Button>
        </div>
      </SectionHeading>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="relative h-[360px] overflow-hidden rounded-[16px] border border-line bg-[linear-gradient(135deg,#eef2f4,#e3edeb)]">
          <div className="absolute left-0 top-1/2 h-2 w-full -translate-y-1/2 bg-silver/40" />
          <div className="absolute left-1/3 top-0 h-full w-2 bg-silver/40" />
          <div className="absolute right-1/4 top-0 h-full w-1.5 bg-silver/30" />
          <div className="absolute left-4 top-4 rounded-[10px] bg-panel/80 px-3 py-2 backdrop-blur">
            <strong className="block text-xs text-ink">Mapa operacional</strong>
            <small className="text-[11px] text-muted">Posicoes simuladas ate integrar GPS real</small>
          </div>
          {visible.map((l) => {
            const teamIndex = Number(l.team.replace(/\D/g, "")) - 1;
            return (
              <motion.button
                key={l.team}
                onClick={() => setActive(l.team)}
                animate={{ left: `${l.x}%`, top: `${l.y}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 18 }}
                className={cn(
                  "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1",
                )}
                style={{ left: `${l.x}%`, top: `${l.y}%` }}
              >
                <span
                  className={cn(
                    "size-4 rounded-full ring-4 ring-white",
                    teamColor[teamIndex] ?? "bg-teal",
                    active === l.team && "scale-125",
                  )}
                />
                <span className="whitespace-nowrap rounded-full bg-panel/90 px-2 py-0.5 text-[10px] font-semibold text-ink shadow-sm">
                  {l.team} · {Math.round(l.speed)}km/h
                </span>
              </motion.button>
            );
          })}
        </section>

        <aside className="flex flex-col gap-2">
          {visible.map((l) => {
            const st = status(l.team, l.status);
            return (
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
                  <Badge tone={statusTone(st)}>{st}</Badge>
                </div>
                <span className="block text-xs text-muted">{members(l.team)}</span>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted">Veiculo</span>
                    <strong className="block text-ink">{l.vehicle}</strong>
                  </div>
                  <div>
                    <span className="text-muted">OS atual</span>
                    <strong className="block text-ink">{currentOrder(l.team)}</strong>
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
            );
          })}
        </aside>
      </div>
    </Card>
  );
}
