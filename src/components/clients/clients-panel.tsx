"use client";

import { useRef, useState } from "react";
import { Plus, Save, Search, UserCheck, UserX, Upload, Cpu, Wifi, WifiOff, Wrench } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, SectionHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useClients,
  useClient,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useImportClients,
  type Client,
  type ImportClientRow,
} from "@/hooks/useClients";
import { useCreateChip, useDeleteChip, type Chip } from "@/hooks/useChips";
import { useDebounce } from "@/hooks/useDebounce";

const clientSchema = z.object({
  name: z.string().min(2, "Informe o nome"),
  document: z.string().min(3, "Codigo ou CPF/CNPJ obrigatorio").max(30),
  phone: z.string().optional(),
  email: z.string().email("E-mail invalido").optional().or(z.literal("")),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  contactName: z.string().optional(),
});
type ClientForm = z.input<typeof clientSchema>;

const emptyForm: ClientForm = {
  name: "", document: "", phone: "", email: "",
  address: "", neighborhood: "", city: "", state: "", contactName: "",
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function cleanPhone(raw: string): string {
  if (!raw) return "";
  const first = raw.split(/\s{2,}/)[0].trim();
  return first.replace(/[^\d+()\-\s]/g, "").trim().slice(0, 20);
}

function parseCSV(text: string): ImportClientRow[] {
  const lines = text.split(/\r?\n/);
  const header = parseCSVLine(lines[0]);
  const idx = {
    codigo: header.indexOf("codigo"),
    fantasia: header.indexOf("fantasia"),
    razao_social: header.indexOf("razao_social"),
    responsavel: header.indexOf("responsavel"),
    logradouro: header.indexOf("logradouro"),
    bairro: header.indexOf("bairro"),
    cidade: header.indexOf("cidade"),
    uf: header.indexOf("uf"),
    telefone_1: header.indexOf("telefone_1"),
  };

  const seen = new Map<string, number>();
  const rows: ImportClientRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCSVLine(line);
    const codigo = cols[idx.codigo]?.trim() ?? "";
    const fantasia = cols[idx.fantasia]?.trim() ?? "";
    const razao = cols[idx.razao_social]?.trim() ?? "";
    const name = fantasia || razao || `CLIENTE-${codigo}`;

    const base = codigo.padStart(4, "0");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const document = count === 0 ? base : `${base}-${count}`;

    rows.push({
      name,
      document,
      phone: cleanPhone(cols[idx.telefone_1] ?? "") || undefined,
      address: cols[idx.logradouro]?.trim() || undefined,
      neighborhood: cols[idx.bairro]?.trim() || undefined,
      city: cols[idx.cidade]?.trim() || undefined,
      state: cols[idx.uf]?.trim() || undefined,
      contactName: cols[idx.responsavel]?.trim() || undefined,
    });
  }
  return rows;
}

interface ImportState {
  rows: ImportClientRow[];
  status: "preview" | "importing" | "done";
  result?: { created: number; skipped: number; errors: string[] };
}

export function ClientsPanel() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit" | "import">("view");
  const [importState, setImportState] = useState<ImportState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useClients(debouncedSearch || undefined);
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const importClients = useImportClients();

  const clients = data?.clients ?? [];
  const selected = clients.find((c) => c.id === selectedId);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: emptyForm,
  });

  function startCreate() {
    setMode("create");
    setSelectedId(null);
    reset(emptyForm);
  }

  function startEdit(client: Client) {
    setMode("edit");
    setSelectedId(client.id);
    reset({
      name: client.name,
      document: client.document,
      phone: client.phone ?? "",
      email: client.email ?? "",
      address: client.address ?? "",
      neighborhood: client.neighborhood ?? "",
      city: client.city ?? "",
      state: client.state ?? "",
      contactName: client.contactName ?? "",
    });
  }

  function onSubmit(formData: ClientForm) {
    const payload = {
      name: formData.name,
      document: formData.document,
      phone: formData.phone || undefined,
      email: formData.email || undefined,
      address: formData.address || undefined,
      neighborhood: formData.neighborhood || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      contactName: formData.contactName || undefined,
    };

    if (mode === "create") {
      createClient.mutate(payload, { onSuccess: () => { setMode("view"); reset(emptyForm); } });
    } else if (mode === "edit" && selectedId) {
      updateClient.mutate({ id: selectedId, ...payload }, { onSuccess: () => setMode("view") });
    }
  }

  function handleDelete(id: string) {
    deleteClient.mutate(id, { onSuccess: () => { setSelectedId(null); setMode("view"); } });
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      setImportState({ rows, status: "preview" });
      setMode("import");
    };
    reader.readAsText(file, "utf-8");
  }

  async function confirmImport() {
    if (!importState) return;
    setImportState((s) => s ? { ...s, status: "importing" } : s);

    // Enviar em lotes de 200
    const BATCH = 200;
    let created = 0, skipped = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < importState.rows.length; i += BATCH) {
      const batch = importState.rows.slice(i, i + BATCH);
      const result = await importClients.mutateAsync(batch);
      created += result.created;
      skipped += result.skipped;
      allErrors.push(...result.errors);
    }

    setImportState((s) => s ? { ...s, status: "done", result: { created, skipped, errors: allErrors } } : s);
  }

  const isSaving = createClient.isPending || updateClient.isPending;

  return (
    <Card>
      <input ref={fileRef} type="file" accept=".csv" hidden onChange={onFileChange} />
      <SectionHeading eyebrow="Clientes" title="Cadastro e historico">
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload /> Importar CSV
        </Button>
        <Button onClick={startCreate} size="sm">
          <Plus /> Novo cliente
        </Button>
      </SectionHeading>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Lista */}
        <section className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome, codigo ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading && (
            <div className="py-10 text-center text-sm text-muted">Carregando clientes...</div>
          )}
          {!isLoading && clients.length === 0 && (
            <div className="py-10 text-center text-sm text-muted">
              {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {clients.map((client) => (
              <button
                key={client.id}
                onClick={() => { setSelectedId(client.id); setMode("view"); }}
                className={cn(
                  "flex items-center justify-between rounded-[10px] border border-line bg-panel p-3 text-left transition-colors hover:border-teal/50",
                  selectedId === client.id && "border-teal bg-teal-soft/40",
                )}
              >
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm text-ink">{client.name}</strong>
                  <small className="block truncate text-xs text-muted">
                    {client.document}
                    {client.phone && ` · ${client.phone}`}
                    {client.city && ` · ${client.city}${client.state ? `/${client.state}` : ""}`}
                  </small>
                  {(client.chips?.length ?? 0) > 0 && (
                    <small className="flex items-center gap-1 text-[11px] text-teal">
                      <Cpu className="size-2.5" />
                      {client.chips.length} chip{client.chips.length > 1 ? "s" : ""}
                    </small>
                  )}
                </span>
                <Badge tone={client.isBlocked ? "red" : "teal"}>
                  {client.isBlocked ? "Bloqueado" : "Ativo"}
                </Badge>
              </button>
            ))}
          </div>

          {data && data.total > clients.length && (
            <p className="text-center text-xs text-muted">{data.total} clientes no total</p>
          )}
        </section>

        {/* Painel lateral */}
        <aside>
          {/* Importação CSV */}
          {mode === "import" && importState && (
            <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-panel-soft/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase text-muted">Importação</span>
                  <strong className="block text-sm text-ink">CSV detectado</strong>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setMode("view")}>
                  Fechar
                </Button>
              </div>

              {importState.status === "preview" && (
                <>
                  <div className="rounded-[10px] border border-line bg-panel p-3 text-sm">
                    <p className="font-semibold text-ink">{importState.rows.length} clientes encontrados</p>
                    <p className="mt-1 text-xs text-muted">
                      Prévia dos primeiros 5:
                    </p>
                    <ul className="mt-2 flex flex-col gap-1">
                      {importState.rows.slice(0, 5).map((r, i) => (
                        <li key={i} className="truncate text-xs text-muted">
                          {r.document} — {r.name}{r.city ? ` (${r.city})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-muted">
                    Clientes que já existem pelo código serão ignorados.
                  </p>
                  <Button onClick={confirmImport} disabled={importClients.isPending}>
                    <Upload /> Importar {importState.rows.length} clientes
                  </Button>
                </>
              )}

              {importState.status === "importing" && (
                <div className="py-8 text-center text-sm text-muted">
                  Importando... aguarde.
                </div>
              )}

              {importState.status === "done" && importState.result && (
                <div className="flex flex-col gap-2">
                  <div className="rounded-[10px] border border-teal/30 bg-teal-soft/40 p-3">
                    <p className="text-sm font-semibold text-ink">Importação concluída</p>
                    <p className="text-xs text-muted">
                      ✅ {importState.result.created} criados · ⏭ {importState.result.skipped} já existiam
                    </p>
                    {importState.result.errors.length > 0 && (
                      <p className="mt-1 text-xs text-red">
                        ❌ {importState.result.errors.length} erros
                      </p>
                    )}
                  </div>
                  <Button variant="secondary" onClick={() => setMode("view")}>
                    Fechar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Formulário criar/editar */}
          {(mode === "create" || mode === "edit") && (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-3 rounded-[14px] border border-line bg-panel-soft/40 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase text-muted">
                    {mode === "create" ? "Novo cliente" : "Editando"}
                  </span>
                  <strong className="block text-sm text-ink">
                    {mode === "create" ? "Preencha os dados" : selected?.name}
                  </strong>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setMode("view")}>
                  Cancelar
                </Button>
              </div>

              <Label>
                Nome / Razao social
                <Input {...register("name")} />
                {errors.name && <span className="text-[10px] text-red">{errors.name.message}</span>}
              </Label>
              <Label>
                Codigo / CPF / CNPJ
                <Input {...register("document")} placeholder="Ex: 0001, 123.456.789-00" />
                {errors.document && <span className="text-[10px] text-red">{errors.document.message}</span>}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Label>
                  Telefone
                  <Input {...register("phone")} placeholder="(68) 99999-9999" />
                </Label>
                <Label>
                  Responsavel
                  <Input {...register("contactName")} placeholder="Nome do contato" />
                </Label>
              </div>
              <Label>
                E-mail
                <Input {...register("email")} type="email" placeholder="cliente@email.com" />
                {errors.email && <span className="text-[10px] text-red">{errors.email.message}</span>}
              </Label>
              <Label>
                Logradouro
                <Input {...register("address")} placeholder="Rua, número..." />
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Label>
                  Bairro
                  <Input {...register("neighborhood")} />
                </Label>
                <Label>
                  Cidade
                  <Input {...register("city")} />
                </Label>
              </div>
              <Label className="w-24">
                UF
                <Input {...register("state")} maxLength={2} placeholder="AC" />
              </Label>

              <Button type="submit" disabled={isSaving}>
                <Save /> {isSaving ? "Salvando..." : "Salvar cliente"}
              </Button>
            </form>
          )}

          {/* Detalhe do cliente */}
          {mode === "view" && selected && (
            <ClientDetail
              client={selected}
              onEdit={() => startEdit(selected)}
              onDelete={() => handleDelete(selected.id)}
              isDeleting={deleteClient.isPending}
            />
          )}

          {mode === "view" && !selected && (
            <div className="flex flex-col items-center justify-center rounded-[14px] border border-line bg-panel-soft/40 py-16 text-center">
              <p className="text-sm text-muted">Nenhum cliente selecionado.</p>
              <p className="mt-1 text-xs text-muted">
                Selecione um cliente para ver os detalhes ou crie um novo.
              </p>
            </div>
          )}
        </aside>
      </div>
    </Card>
  );
}

const chipFormSchema = z.object({
  iccid: z.string().min(3, "ICCID obrigatorio"),
  phoneNumber: z.string().optional(),
  operator: z.string().optional(),
  model: z.string().optional(),
  notes: z.string().optional(),
});
type ChipForm = z.input<typeof chipFormSchema>;

function ClientDetail({
  client,
  onEdit,
  onDelete,
  isDeleting,
}: {
  client: Client;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { data: fullClient } = useClient(client.id);
  const fc = fullClient ?? client;

  const [showChipForm, setShowChipForm] = useState(false);
  const createChip = useCreateChip();
  const deleteChip = useDeleteChip();

  const {
    register: regChip,
    handleSubmit: handleChipSubmit,
    reset: resetChip,
    formState: { errors: chipErrors },
  } = useForm<ChipForm>({ resolver: zodResolver(chipFormSchema) });

  function onSubmitChip(data: ChipForm) {
    createChip.mutate(
      { ...data, clientId: client.id },
      {
        onSuccess: () => {
          setShowChipForm(false);
          resetChip();
        },
      }
    );
  }

  const chips: Chip[] = (fc as Client & { chips?: Chip[] }).chips ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-panel-soft/40 p-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <span className="text-xs uppercase text-muted">Cliente</span>
          <strong className="block truncate text-sm text-ink">{fc.name}</strong>
        </div>
        <Badge tone={fc.isBlocked ? "red" : "teal"}>
          {fc.isBlocked ? <UserX className="size-3" /> : <UserCheck className="size-3" />}
          {fc.isBlocked ? "Bloqueado" : "Ativo"}
        </Badge>
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        <Row label="Codigo/Doc" value={fc.document} />
        {fc.contactName && <Row label="Responsavel" value={fc.contactName} />}
        {fc.phone && <Row label="Telefone" value={fc.phone} />}
        {fc.email && <Row label="E-mail" value={fc.email} />}
        {(fc.address || fc.neighborhood) && (
          <Row
            label="Endereco"
            value={[fc.address, fc.neighborhood, fc.city, fc.state].filter(Boolean).join(", ")}
          />
        )}
        {fc.city && !fc.address && (
          <Row label="Cidade" value={`${fc.city}${fc.state ? `/${fc.state}` : ""}`} />
        )}
        <Row label="Cadastro" value={new Date(fc.createdAt).toLocaleDateString("pt-BR")} />
      </div>

      {/* ── Seção de Chips ── */}
      <div className="rounded-[10px] border border-teal/30 bg-teal-soft/10 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Cpu className="size-3.5 text-teal" />
            <strong className="text-xs text-teal">
              Chips{chips.length > 0 ? ` (${chips.length})` : ""}
            </strong>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => setShowChipForm((v) => !v)}
          >
            <Plus className="size-3" /> Adicionar
          </Button>
        </div>

        {showChipForm && (
          <form
            onSubmit={handleChipSubmit(onSubmitChip)}
            className="mb-3 flex flex-col gap-2 rounded-[8px] border border-teal/20 bg-panel p-3"
          >
            <Label className="text-[11px]">
              ICCID <span className="text-red">*</span>
              <Input
                {...regChip("iccid")}
                placeholder="89550400..."
                className="h-7 text-xs"
              />
              {chipErrors.iccid && (
                <span className="text-[10px] text-red">{chipErrors.iccid.message}</span>
              )}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Label className="text-[11px]">
                Operadora
                <Input {...regChip("operator")} placeholder="Vivo, Claro..." className="h-7 text-xs" />
              </Label>
              <Label className="text-[11px]">
                Numero
                <Input {...regChip("phoneNumber")} placeholder="(68) 9..." className="h-7 text-xs" />
              </Label>
            </div>
            <Label className="text-[11px]">
              Modelo
              <Input {...regChip("model")} placeholder="SIM micro, nano..." className="h-7 text-xs" />
            </Label>
            <Label className="text-[11px]">
              Observacoes
              <Input {...regChip("notes")} className="h-7 text-xs" />
            </Label>
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="flex-1 h-7 text-xs" disabled={createChip.isPending}>
                <Save className="size-3" /> Salvar chip
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setShowChipForm(false); resetChip(); }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {chips.length === 0 && !showChipForm && (
          <p className="text-center text-[11px] text-muted py-2">
            Nenhum chip registrado para este cliente.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {chips.map((chip) => (
            <ChipCard key={chip.id} chip={chip} onDelete={() => deleteChip.mutate(chip.id)} />
          ))}
        </div>
      </div>

      {fc.isBlocked && fc.blockedReason && (
        <p className="rounded-[8px] bg-red-soft/40 p-2.5 text-xs text-red">
          Motivo do bloqueio: {fc.blockedReason}
        </p>
      )}

      {/* Historico de OS */}
      {fc.serviceOrders && fc.serviceOrders.length > 0 && (
        <div>
          <strong className="mb-1.5 block text-xs text-muted uppercase">Historico de OS</strong>
          <div className="flex flex-col gap-1.5">
            {fc.serviceOrders.slice(0, 5).map((os) => (
              <div
                key={os.id}
                className="flex items-center justify-between rounded-[8px] border border-line bg-panel p-2 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-teal">OS-{String(os.number).padStart(4, "0")}</span>
                  {os.description && (
                    <span className="ml-1.5 truncate text-muted">{os.description.slice(0, 30)}</span>
                  )}
                  {os.chipId && (
                    <span className="ml-1.5 flex items-center gap-0.5 text-[10px] text-teal">
                      <Cpu className="size-2.5" /> {os.chipId}
                    </span>
                  )}
                </div>
                <Badge
                  tone={
                    os.status === "COMPLETED" ? "teal"
                    : os.status === "CANCELLED" ? "red"
                    : "amber"
                  }
                >
                  {os.status === "COMPLETED" ? "Concluida"
                   : os.status === "CANCELLED" ? "Cancelada"
                   : "Em aberto"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button className="flex-1" size="sm" onClick={onEdit}>
          <Save /> Editar
        </Button>
        <DeleteButton size="sm" disabled={isDeleting} onConfirm={onDelete} />
      </div>
    </div>
  );
}

const CHIP_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  MAINTENANCE: "Manutencao",
};

function ChipCard({ chip, onDelete }: { chip: Chip; onDelete: () => void }) {
  const toneMap: Record<string, "teal" | "red" | "amber"> = {
    ACTIVE: "teal",
    INACTIVE: "red",
    MAINTENANCE: "amber",
  };
  const IconMap: Record<string, typeof Wifi> = {
    ACTIVE: Wifi,
    INACTIVE: WifiOff,
    MAINTENANCE: Wrench,
  };
  const StatusIcon = IconMap[chip.status] ?? Cpu;

  return (
    <div className="rounded-[8px] border border-line bg-panel p-2.5 text-xs">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Cpu className="size-3 shrink-0 text-teal" />
          <span className="font-mono font-semibold text-ink truncate">{chip.iccid}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge tone={toneMap[chip.status] ?? "amber"}>
            <StatusIcon className="size-2.5" />
            {CHIP_STATUS_LABEL[chip.status] ?? chip.status}
          </Badge>
          <DeleteButton compact onConfirm={onDelete} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted">
        {chip.operator && (
          <><span className="text-muted/70">Operadora</span><span className="text-ink">{chip.operator}</span></>
        )}
        {chip.phoneNumber && (
          <><span className="text-muted/70">Numero</span><span className="text-ink">{chip.phoneNumber}</span></>
        )}
        {chip.model && (
          <><span className="text-muted/70">Modelo</span><span className="text-ink">{chip.model}</span></>
        )}
        {chip.installedAt && (
          <><span className="text-muted/70">Instalado</span><span className="text-ink">{new Date(chip.installedAt).toLocaleDateString("pt-BR")}</span></>
        )}
        {chip.serviceOrder && (
          <><span className="text-muted/70">Via OS</span><span className="text-teal">OS-{String(chip.serviceOrder.number).padStart(4, "0")}</span></>
        )}
      </div>

      {chip.notes && (
        <p className="mt-1.5 text-[11px] text-muted italic">{chip.notes}</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 truncate text-right text-ink">{value}</span>
    </div>
  );
}
