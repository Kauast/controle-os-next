"use client";

import { useState } from "react";
import { Card, SectionHeading } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TEAMS } from "@/lib/types";
import { useTeamReport } from "@/hooks/queries";

const instructors: { name: string; instructed: number; redirected: number; pending: number; last: string }[] = [];

export function ReportsPanel() {
  const [filter, setFilter] = useState("all");
  const { data, isLoading } = useTeamReport(filter);
  const total = data?.reduce((s, r) => s + r.completed, 0) ?? 0;

  return (
    <Card>
      <SectionHeading eyebrow="Gestao e supervisao" title="Relatorios">
        <Tabs defaultValue="equipes">
          <TabsList>
            <TabsTrigger value="equipes">Equipes</TabsTrigger>
            <TabsTrigger value="instrucao">Instrucao OS</TabsTrigger>
          </TabsList>
        </Tabs>
      </SectionHeading>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-[14px] border border-line bg-panel-soft/40 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <span className="text-xs uppercase text-muted">Relatorio por equipe</span>
              <strong className="block text-sm text-ink">Produtividade e qualidade</strong>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-9 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {TEAMS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge tone="teal">{total} concluidas</Badge>
            </div>
          </div>
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted">Carregando relatorio...</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Equipe</TH>
                  <TH>OS</TH>
                  <TH>Tempo</TH>
                  <TH>Fotos</TH>
                  <TH>Assin.</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {data?.map((r) => (
                  <TR key={r.team}>
                    <TD>{r.team}</TD>
                    <TD>{r.completed}</TD>
                    <TD>{r.time}</TD>
                    <TD>{r.photos}</TD>
                    <TD>{r.signatures}</TD>
                    <TD>
                      <Badge tone={r.pill}>{r.status}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </section>

        <section className="rounded-[14px] border border-line bg-panel-soft/40 p-4">
          <div className="mb-3">
            <span className="text-xs uppercase text-muted">Quem instrui as OS</span>
            <strong className="block text-sm text-ink">Distribuicao e pendencias</strong>
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Responsavel</TH>
                <TH>Instruidas</TH>
                <TH>Redir.</TH>
                <TH>Pend.</TH>
                <TH>Ultima acao</TH>
              </TR>
            </THead>
            <TBody>
              {instructors.map((i) => (
                <TR key={i.name}>
                  <TD>{i.name}</TD>
                  <TD>{i.instructed}</TD>
                  <TD>{i.redirected}</TD>
                  <TD>{i.pending}</TD>
                  <TD className="text-xs text-muted">{i.last}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </section>
      </div>
    </Card>
  );
}
