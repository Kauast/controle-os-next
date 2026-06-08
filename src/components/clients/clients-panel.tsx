"use client";

import { Card, SectionHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const history = [
  {
    code: "OS-1048",
    date: "05/06/2026",
    title: "Portao automatico sem resposta",
    meta: ["3 fotos", "Assinatura pendente", "ID CHIP pendente"],
    team: "Equipe 1 · Bruno · Servico em andamento",
    open: true,
  },
  {
    code: "OS-0987",
    date: "18/05/2026",
    title: "Preventiva do motor e sensores",
    meta: ["3 fotos", "Assinada", "Concluida"],
    team: "Equipe 3 · Marcos · Concluida",
    open: false,
  },
];

export function ClientsPanel() {
  return (
    <Card>
      <SectionHeading eyebrow="Cliente Alpha Condominio" title="Historico do cliente">
        <Button variant="ghost" size="sm">
          Abrir cadastro
        </Button>
      </SectionHeading>

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Cliente", main: "Alpha Condominio", sub: "Sindico Joao · (11) 4000-1000" },
          { label: "Endereco", main: "Rua das Flores, 120", sub: "Portaria 24h · zona norte" },
          { label: "Ultima OS", main: "OS-1048", sub: "Em andamento com Equipe 1" },
          { label: "Historico", main: "2 OS", sub: "Fotos e assinaturas arquivadas" },
        ].map((c) => (
          <div key={c.label} className="rounded-[12px] border border-line bg-panel-soft/40 p-3.5">
            <span className="text-xs text-muted">{c.label}</span>
            <strong className="mt-1 block text-sm text-ink">{c.main}</strong>
            <small className="text-xs text-muted">{c.sub}</small>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {history.map((h) => (
          <article
            key={h.code}
            className="grid gap-3 rounded-[14px] border border-line bg-panel-soft/40 p-4 lg:grid-cols-[1fr_auto]"
          >
            <div>
              <span className="text-xs text-muted">
                {h.code} · {h.date}
              </span>
              <strong className="block text-sm text-ink">{h.title}</strong>
              <div className="mt-1 flex flex-wrap gap-2">
                {h.meta.map((m) => (
                  <Badge key={m} tone={h.open ? "amber" : "teal"}>
                    {m}
                  </Badge>
                ))}
              </div>
              <small className="mt-1 block text-xs text-muted">{h.team}</small>
            </div>
            <div className="flex gap-2">
              {["Antes", "Durante", "Depois", "Assinatura"].map((p) => (
                <div
                  key={p}
                  className="grid size-16 place-items-center rounded-[10px] border border-dashed border-line bg-panel text-center text-[10px] text-muted"
                >
                  {p}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}
