"use client";

import { DollarSign, TrendingUp, Package, Calendar } from "lucide-react";
import { Card, SectionHeading } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { useFinance } from "@/hooks/queries";

export function FinancePanel() {
  const { data, isLoading } = useFinance();

  if (isLoading) {
    return (
      <Card>
        <SectionHeading eyebrow="Receitas, custos e margem" title="Financeiro" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-[16px] bg-panel" />
          ))}
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <SectionHeading eyebrow="Receitas, custos e margem" title="Financeiro" />
        <EmptyState
          icon={<DollarSign className="size-5" />}
          title="Sem dados financeiros"
          description="Os dados de faturamento aparecerão aqui quando disponíveis."
        />
      </Card>
    );
  }

  const ticketMedio   = data.servicesScheduled > 0
    ? data.forecast / data.servicesScheduled
    : 0;

  return (
    <Card>
      <SectionHeading eyebrow="Receitas, custos e margem" title="Financeiro" />

      <section className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          index={0}
          label="Faturamento Previsto"
          value={formatCurrency(data.forecast)}
          hint="Serviços com valor registrado"
          success
          icon={<TrendingUp className="size-3.5" />}
        />
        <StatCard
          index={1}
          label="Material Vendido"
          value={formatCurrency(data.materialSold)}
          hint="Itens saídos do estoque"
          icon={<Package className="size-3.5" />}
        />
        <StatCard
          index={2}
          label="Valor do Estoque"
          value={formatCurrency(data.stockValue)}
          hint="Custo estimado em almoxarifado"
          icon={<DollarSign className="size-3.5" />}
        />
        <StatCard
          index={3}
          label="Serviços Agendados"
          value={data.servicesScheduled}
          hint={`Ticket médio ${formatCurrency(ticketMedio)}`}
          icon={<Calendar className="size-3.5" />}
        />
      </section>

      <section>
        <div className="mb-3">
          <span className="label-eyebrow">Resumo mensal</span>
          <h2 className="mt-1 text-base font-semibold text-ink">Histórico de faturamento</h2>
        </div>

        <div className="overflow-x-auto rounded-[12px] border border-line">
          <Table>
            <THead>
              <TR>
                <TH>Mês</TH>
                <TH>Material vendido</TH>
                <TH>Valor dos serviços</TH>
                <TH>Previsto</TH>
                <TH>Estoque total</TH>
              </TR>
            </THead>
            <TBody>
              {data.monthly.map((m) => (
                <TR key={m.month}>
                  <TD className="font-medium text-ink">{m.month}</TD>
                  <TD>{formatCurrency(m.material)}</TD>
                  <TD>{formatCurrency(m.services)}</TD>
                  <TD className="font-semibold text-teal">{formatCurrency(m.forecast)}</TD>
                  <TD className="text-muted">{formatCurrency(m.stock)}</TD>
                </TR>
              ))}
              {data.monthly.length === 0 && (
                <TR>
                  <TD colSpan={5} className="py-8 text-center text-sm text-muted">
                    Nenhum dado mensal disponível.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </div>
      </section>
    </Card>
  );
}
