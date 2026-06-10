"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Cpu,
  Mail,
  MapPin,
  Phone,
  Search,
  User,
  Wifi,
  WifiOff,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useClients, useClient, type Client } from "@/hooks/useClients";
import { useDebounce } from "@/hooks/useDebounce";
import type { Chip } from "@/hooks/useChips";

type StatusFilter = "all" | "active" | "blocked";

/* ── helpers ── */

function osStatusTone(status: string): "teal" | "red" | "amber" {
  if (status === "COMPLETED") return "teal";
  if (status === "CANCELLED") return "red";
  return "amber";
}

function osStatusLabel(status: string): string {
  if (status === "COMPLETED") return "Concluída";
  if (status === "CANCELLED") return "Cancelada";
  return "Em andamento";
}

const CHIP_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  MAINTENANCE: "Manutenção",
};

const chipTone: Record<string, "teal" | "red" | "amber"> = {
  ACTIVE: "teal",
  INACTIVE: "red",
  MAINTENANCE: "amber",
};

function ChipIcon({ status }: { status: string }) {
  if (status === "INACTIVE") return <WifiOff className="size-2.5" />;
  if (status === "MAINTENANCE") return <Wrench className="size-2.5" />;
  return <Wifi className="size-2.5" />;
}

/* ── ClientListRow ── */

function ClientListRow({
  client,
  isSelected,
  onClick,
}: {
  client: Client;
  isSelected: boolean;
  onClick: () => void;
}) {
  const osCount = client.serviceOrders?.length ?? 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-sm border transition-colors",
        isSelected
          ? "border-teal/30 bg-teal/5"
          : "border-transparent hover:border-border hover:bg-muted/40",
      )}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-semibold text-foreground truncate">
              {client.name}
            </span>
            {client.isBlocked && (
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-widest text-red">
                Bloqueado
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="font-mono text-[10px] text-muted-foreground">
              {client.document}
            </span>
            {(client.city || client.state) && (
              <span className="text-[10px] text-muted-foreground/70">
                {[client.city, client.state].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {osCount > 0 && (
            <span className="text-[9px] font-mono text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded-sm">
              {osCount} OS
            </span>
          )}
          {client.chips.length > 0 && (
            <span className="text-[9px] font-mono text-teal/70">
              {client.chips.length} chip{client.chips.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ── ClientDetail ── */

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ChipRow({ chip }: { chip: Chip }) {
  return (
    <div className="flex items-center justify-between rounded-[6px] border border-border bg-card px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <Cpu className="size-3 shrink-0 text-teal" />
        <span className="font-mono text-[11px] font-semibold text-foreground truncate">
          {chip.iccid}
        </span>
        {chip.phoneNumber && (
          <span className="text-[10px] text-muted-foreground">{chip.phoneNumber}</span>
        )}
        {chip.operator && (
          <span className="text-[10px] text-muted-foreground/60">{chip.operator}</span>
        )}
      </div>
      <Badge tone={chipTone[chip.status] ?? "amber"}>
        <ChipIcon status={chip.status} />
        {CHIP_STATUS_LABEL[chip.status] ?? chip.status}
      </Badge>
    </div>
  );
}

function ClientDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: client, isLoading } = useClient(id);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm animate-pulse">
        Carregando...
      </div>
    );
  }

  if (!client) return null;

  const hasAddress =
    client.address || client.neighborhood || client.city || client.state;
  const hasContact = client.phone || client.email || client.contactName;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-foreground leading-tight">
              {client.name}
            </h2>
            {client.isBlocked && <Badge tone="red">Bloqueado</Badge>}
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {client.document}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Contact */}
      <DetailSection title="Contato">
        {hasContact ? (
          <div className="flex flex-col gap-2">
            {client.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-foreground">{client.phone}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-foreground">{client.email}</span>
              </div>
            )}
            {client.contactName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-foreground">{client.contactName}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum contato registrado.</p>
        )}
      </DetailSection>

      {/* Address */}
      {hasAddress && (
        <DetailSection title="Endereço">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-foreground leading-snug">
              {client.address && <div>{client.address}</div>}
              {client.neighborhood && (
                <div className="text-muted-foreground">{client.neighborhood}</div>
              )}
              {(client.city || client.state) && (
                <div className="text-muted-foreground">
                  {[client.city, client.state].filter(Boolean).join(" — ")}
                </div>
              )}
            </div>
          </div>
        </DetailSection>
      )}

      {/* Chips */}
      {client.chips.length > 0 && (
        <DetailSection title={`Chips (${client.chips.length})`}>
          <div className="flex flex-col gap-1.5">
            {client.chips.map((chip) => (
              <ChipRow key={chip.id} chip={chip} />
            ))}
          </div>
        </DetailSection>
      )}

      {/* OS history */}
      {client.serviceOrders && client.serviceOrders.length > 0 && (
        <DetailSection title={`Histórico de OS (${client.serviceOrders.length})`}>
          <div className="flex flex-col gap-1.5">
            {client.serviceOrders.slice(0, 8).map((os) => (
              <div
                key={os.id}
                className="flex items-center justify-between rounded-[6px] border border-border bg-card px-2.5 py-1.5 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-teal font-mono">
                    OS-{String(os.number).padStart(4, "0")}
                  </span>
                  {os.description && (
                    <span className="ml-1.5 text-muted-foreground truncate">
                      {os.description.slice(0, 40)}
                    </span>
                  )}
                  {os.technician && (
                    <span className="ml-1.5 text-muted-foreground/70">
                      · {os.technician.name}
                    </span>
                  )}
                </div>
                <Badge tone={osStatusTone(os.status)}>
                  {osStatusLabel(os.status)}
                </Badge>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {/* Blocked reason */}
      {client.isBlocked && client.blockedReason && (
        <div className="rounded-[8px] bg-red/10 border border-red/20 p-2.5 text-xs text-red">
          Motivo do bloqueio: {client.blockedReason}
        </div>
      )}
    </div>
  );
}

/* ── ClientsDirectoryPanel ── */

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "blocked", label: "Bloqueados" },
];

export function ClientsDirectoryPanel() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useClients(debouncedSearch || undefined);
  const clients = data?.clients ?? [];

  const filtered = useMemo(() => {
    if (statusFilter === "all") return clients;
    return clients.filter((c) =>
      statusFilter === "blocked" ? c.isBlocked : !c.isBlocked,
    );
  }, [clients, statusFilter]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Left pane: search + list */}
      <div className="lg:w-[340px] lg:shrink-0 rounded-lg border border-border bg-card shadow-[var(--shadow-panel)] flex flex-col overflow-hidden">
        {/* Panel header */}
        <div className="p-5 pb-0">
          <SectionHeading eyebrow="Base de clientes" title="Diretório">
            <span className="font-mono text-[11px] text-muted-foreground mt-1">
              {isLoading ? "…" : `${filtered.length}`}
            </span>
          </SectionHeading>
        </div>

        {/* Search */}
        <div className="px-5 pb-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Nome, CNPJ, cidade…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          {/* Status filter pills */}
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "flex-1 py-1 text-[10px] font-semibold uppercase tracking-widest rounded-sm transition-colors",
                  statusFilter === f.value
                    ? "bg-teal/10 text-teal"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto max-h-[60vh] lg:max-h-[calc(100dvh-320px)] border-t border-border p-2 space-y-0.5">
          {isLoading && (
            <div className="py-10 text-center text-[11px] text-muted-foreground animate-pulse">
              Carregando clientes…
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="py-12 text-center text-[11px] text-muted-foreground uppercase tracking-widest">
              Nenhum cliente encontrado
            </div>
          )}
          {filtered.map((client) => (
            <ClientListRow
              key={client.id}
              client={client}
              isSelected={selectedId === client.id}
              onClick={() =>
                setSelectedId((prev) => (prev === client.id ? null : client.id))
              }
            />
          ))}
        </div>
      </div>

      {/* Right pane: detail */}
      <div className="flex-1 rounded-lg border border-border bg-card shadow-[var(--shadow-panel)] p-5 min-h-[400px] lg:min-h-[calc(100dvh-180px)] flex">
        {selectedId ? (
          <ClientDetail
            key={selectedId}
            id={selectedId}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <Building2 className="size-10 text-muted-foreground/20" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Selecione um cliente
              </p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                Clique na lista para ver todos os dados
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
