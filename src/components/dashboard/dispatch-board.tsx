"use client";

import { useState } from "react";
import { Card, SectionHeading } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { access } from "@/lib/access";
import { orderTone, sortOrders, toneBorder } from "@/lib/orders";
import { TEAMS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import { useVisibleOrders } from "@/hooks/use-visible-orders";
import { STATUS_DOT } from "@/lib/constants";

function DispatchCard({ code, client, time }: { code: string; client: string; time: string }) {
  return (
    <span className="block">
      <strong className="block text-sm text-ink">{code}</strong>
      <span className="block text-xs text-muted">{client}</span>
      <small className="text-[11px] text-muted">{time}</small>
    </span>
  );
}

export function DispatchBoard() {
  const role = useAppStore((s) => s.role);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const technicians = useAppStore((s) => s.technicians);
  const assignOrder = useAppStore((s) => s.assignOrder);
  const orders = useVisibleOrders();
  const [dragCode, setDragCode] = useState<string | null>(null);
  const [overTeam, setOverTeam] = useState<string | null>(null);

  const technicianView = !access.seesAllOrders(role);
  const available = sortOrders(orders.filter((o) => o.team === "Sem equipe"));

  const teamMembers = (team: string) =>
    technicians
      .filter((t) => t.team === team)
      .map((t) => t.name)
      .join(", ") || "Sem tecnico";
  const teamStatus = (team: string) =>
    technicians.find((t) => t.team === team && t.status !== "Disponivel")?.status ?? "Disponivel";

  const visibleTeams = technicianView ? TEAMS.filter((t) => t === activeTeam) : TEAMS;

  function drop(team: string) {
    if (dragCode) assignOrder(dragCode, team);
    setDragCode(null);
    setOverTeam(null);
  }

  return (
    <Card>
      <SectionHeading eyebrow="Agenda das equipes" title="OS do dia e despacho" />

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        {!technicianView && (
          <section
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop("Sem equipe")}
            className="rounded-[14px] border border-dashed border-line bg-panel-soft/60 p-3"
          >
            <div className="mb-2">
              <strong className="text-sm text-ink">OS disponiveis</strong>
              <p className="text-xs text-muted">Arraste para uma equipe</p>
            </div>
            <div className="flex flex-col gap-2">
              {available.map((o) => (
                <article
                  key={o.code}
                  draggable
                  onDragStart={() => setDragCode(o.code)}
                  className={cn(
                    "cursor-grab rounded-[10px] border border-line bg-panel p-2.5 active:cursor-grabbing",
                    toneBorder[orderTone(o)],
                  )}
                >
                  <DispatchCard code={o.code} client={o.client} time={`${o.time} · ${o.description.slice(0, 22)}`} />
                </article>
              ))}
              {available.length === 0 && (
                <span className="py-6 text-center text-xs text-muted">Tudo distribuido</span>
              )}
            </div>
          </section>
        )}

        <section
          className={cn(
            "grid gap-2.5",
            technicianView ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-5",
          )}
        >
          {visibleTeams.map((team) => {
            const teamOrders = sortOrders(orders.filter((o) => o.team === team));
            const status = teamStatus(team);
            return (
              <article
                key={team}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverTeam(team);
                }}
                onDragLeave={() => setOverTeam((t) => (t === team ? null : t))}
                onDrop={() => drop(team)}
                className={cn(
                  "flex flex-col gap-2 rounded-[14px] border border-line bg-panel-soft/50 p-2.5 transition-colors",
                  overTeam === team && "border-teal bg-teal-soft/50",
                )}
              >
                <div className="leading-tight">
                  <strong className="flex items-center gap-1.5 text-sm text-ink">
                    {team}
                    <span className={cn("size-2 rounded-full", STATUS_DOT[status] ?? "bg-teal")} />
                  </strong>
                  <span className="block text-[11px] text-muted">{teamMembers(team)}</span>
                  <small className="text-[11px] text-muted">{status}</small>
                </div>
                <div className="flex min-h-[64px] flex-col gap-2">
                  {teamOrders.map((o) => (
                    <article
                      key={o.code}
                      draggable
                      onDragStart={() => setDragCode(o.code)}
                      className={cn(
                        "cursor-grab rounded-[10px] border border-line bg-panel p-2.5",
                        toneBorder[orderTone(o)],
                      )}
                    >
                      <DispatchCard code={o.code} client={o.client} time={`${o.time} · ${o.status === "completed" ? "concluida" : "agendada"}`} />
                    </article>
                  ))}
                  {teamOrders.length === 0 && (
                    <span className="grid flex-1 place-items-center rounded-[10px] border border-dashed border-line py-3 text-[11px] text-muted">
                      Solte uma OS aqui
                    </span>
                  )}
                </div>
                {teamOrders.some((o) => o.priority === "high") && (
                  <Badge tone="red" className="self-start">
                    Prioridade alta
                  </Badge>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </Card>
  );
}
