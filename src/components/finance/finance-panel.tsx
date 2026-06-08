"use client";

import { Card, SectionHeading } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { useFinance } from "@/hooks/queries";

export function FinancePanel() {
  const { data, isLoading } = useFinance();

  return (
    <Card>
      <SectionHeading eyebrow="Somente administrador" title="Valores mensais">
        <Badge tone="dark">Acesso restrito</Badge>
      </SectionHeading>

      {isLoading || !data ? (
        <p className="py-6 text-center text-sm text-muted">Carregando financeiro...</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: "Material vendido no mes", value: data.materialSold, hint: "214 itens vendidos" },
              { label: "Servicos agendados", value: data.servicesScheduled, hint: "38 OS com valor" },
              { label: "Faturamento previsto", value: data.forecast, hint: "Junho 2026" },
              { label: "Valor total do estoque", value: data.stockValue, hint: "Custo estimado" },
            ].map((c) => (
              <div key={c.label} className="rounded-[12px] border border-line bg-panel-soft/40 p-3.5">
                <span className="text-xs text-muted">{c.label}</span>
                <strong className="mt-1 block text-lg text-ink">{formatCurrency(c.value)}</strong>
                <small className="text-xs text-muted">{c.hint}</small>
              </div>
            ))}
          </div>

          <Table>
            <THead>
              <TR>
                <TH>Mes</TH>
                <TH>Material vendido</TH>
                <TH>Valor dos servicos</TH>
                <TH>Previsto</TH>
                <TH>Estoque total</TH>
              </TR>
            </THead>
            <TBody>
              {data.monthly.map((m) => (
                <TR key={m.month}>
                  <TD>{m.month}</TD>
                  <TD>{formatCurrency(m.material)}</TD>
                  <TD>{formatCurrency(m.services)}</TD>
                  <TD className="font-semibold">{formatCurrency(m.forecast)}</TD>
                  <TD>{formatCurrency(m.stock)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </>
      )}
    </Card>
  );
}
