"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BarChart3, Download, FileText, Sheet } from "lucide-react";
import { Card, SectionHeading } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TEAMS } from "@/lib/types";
import { useTeamReport, useAttendantReport } from "@/hooks/queries";

const PERIOD_OPTIONS = [
  { value: "today",  label: "Hoje" },
  { value: "week",   label: "Esta semana" },
  { value: "month",  label: "Este mês" },
  { value: "all",    label: "Todos" },
];

function ExportButton({ label, icon: Icon }: { label: string; icon: typeof Download }) {
  return (
    <button
      onClick={() => toast.info(`Exportação de ${label} disponível em breve.`)}
      className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-medium text-muted transition-colors hover:bg-white/8 hover:text-ink"
      aria-label={`Exportar como ${label}`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

export function ReportsPanel() {
  const [teamFilter, setTeamFilter]   = useState("all");
  const [period, setPeriod]           = useState("month");

  const { data: teamData, isLoading: loadingTeam }           = useTeamReport(teamFilter);
  const { data: attendants = [], isLoading: loadingAttendants } = useAttendantReport();

  const total = teamData?.reduce((s, r) => s + r.completed, 0) ?? 0;

  return (
    <Card>
      <SectionHeading eyebrow="Gestão e supervisão" title="Relatórios">
        <div className="flex items-center gap-2">
          <ExportButton label="PDF" icon={FileText} />
          <ExportButton label="Excel" icon={Sheet} />
          <ExportButton label="CSV" icon={Download} />
        </div>
      </SectionHeading>

      {/* Filter bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[12px] border border-line bg-panel-soft/40 px-4 py-3">
        <span className="text-xs font-semibold text-muted">Filtros</span>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Equipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as equipes</SelectItem>
            {TEAMS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge tone="teal" className="ml-auto">{total} OS concluídas</Badge>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Team productivity */}
        <section className="rounded-[14px] border border-line bg-panel-soft/40 p-4">
          <div className="mb-3">
            <span className="label-eyebrow">Produtividade</span>
            <h3 className="mt-0.5 text-sm font-semibold text-ink">Por equipe</h3>
          </div>

          {loadingTeam ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-[8px] bg-panel" />
              ))}
            </div>
          ) : !teamData || teamData.length === 0 ? (
            <EmptyState
              icon={<BarChart3 className="size-4" />}
              title="Sem dados de equipes"
              description="Nenhuma OS concluída no período selecionado."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Equipe</TH>
                    <TH>OS</TH>
                    <TH>Tempo méd.</TH>
                    <TH>Fotos</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {teamData.map((r) => (
                    <TR key={r.team}>
                      <TD className="font-medium text-ink">{r.team}</TD>
                      <TD className="tabular-nums">{r.completed}</TD>
                      <TD className="text-muted tabular-nums">{r.time}</TD>
                      <TD className="tabular-nums">{r.photos}</TD>
                      <TD><Badge tone={r.pill}>{r.status}</Badge></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </section>

        {/* Attendant distribution */}
        <section className="rounded-[14px] border border-line bg-panel-soft/40 p-4">
          <div className="mb-3">
            <span className="label-eyebrow">Distribuição</span>
            <h3 className="mt-0.5 text-sm font-semibold text-ink">Pendências por responsável</h3>
          </div>

          {loadingAttendants ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-[8px] bg-panel" />
              ))}
            </div>
          ) : attendants.length === 0 ? (
            <EmptyState
              icon={<BarChart3 className="size-4" />}
              title="Sem pendências"
              description="Nenhuma OS pendente por responsável neste período."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Responsável</TH>
                    <TH>Instruídas</TH>
                    <TH>Redir.</TH>
                    <TH>Pend.</TH>
                    <TH>Última ação</TH>
                  </TR>
                </THead>
                <TBody>
                  {attendants.map((i) => (
                    <TR key={i.email}>
                      <TD className="font-medium text-ink">{i.name}</TD>
                      <TD className="tabular-nums">{i.instructed}</TD>
                      <TD className="tabular-nums">{i.redirected}</TD>
                      <TD>
                        <Badge tone={i.pending > 0 ? "amber" : "teal"}>{i.pending}</Badge>
                      </TD>
                      <TD className="text-xs text-muted">{i.last}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </Card>
  );
}
