"use client";

import { useState } from "react";
import { Plus, Save, Trash2, Search, UserCheck, UserX } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, SectionHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useClients, useCreateClient, useUpdateClient, useDeleteClient, type Client } from "@/hooks/useClients";
import { useDebounce } from "@/hooks/useDebounce";

const clientSchema = z.object({
  name: z.string().min(2, "Informe o nome"),
  document: z.string().min(11, "CPF ou CNPJ invalido").max(18),
  phone: z.string().optional(),
  email: z.string().email("E-mail invalido").optional().or(z.literal("")),
});
type ClientForm = z.input<typeof clientSchema>;

const emptyForm: ClientForm = { name: "", document: "", phone: "", email: "" };

function formatDocument(doc: string) {
  const d = doc.replace(/\D/g, "");
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export function ClientsPanel() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");

  const { data, isLoading } = useClients(debouncedSearch || undefined);
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const clients = data?.clients ?? [];
  const selected = clients.find((c) => c.id === selectedId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientForm>({
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
    });
  }

  function onSubmit(data: ClientForm) {
    const payload = {
      name: data.name,
      document: data.document.replace(/\D/g, ""),
      phone: data.phone || undefined,
      email: data.email || undefined,
    };

    if (mode === "create") {
      createClient.mutate(payload, {
        onSuccess: () => { setMode("view"); reset(emptyForm); },
      });
    } else if (mode === "edit" && selectedId) {
      updateClient.mutate({ id: selectedId, ...payload }, {
        onSuccess: () => setMode("view"),
      });
    }
  }

  function handleDelete(id: string) {
    deleteClient.mutate(id, {
      onSuccess: () => { setSelectedId(null); setMode("view"); },
    });
  }

  const isSaving = createClient.isPending || updateClient.isPending;

  return (
    <Card>
      <SectionHeading eyebrow="Clientes" title="Cadastro e historico">
        <Button onClick={startCreate} size="sm">
          <Plus /> Novo cliente
        </Button>
      </SectionHeading>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Lista de clientes */}
        <section className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted" />
              <Input
                className="pl-8"
                placeholder="Buscar por nome ou documento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
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
                <span>
                  <strong className="block text-sm text-ink">{client.name}</strong>
                  <small className="text-xs text-muted">
                    {formatDocument(client.document)}
                    {client.phone && ` · ${client.phone}`}
                  </small>
                </span>
                <Badge tone={client.isBlocked ? "red" : "teal"}>
                  {client.isBlocked ? "Bloqueado" : "Ativo"}
                </Badge>
              </button>
            ))}
          </div>

          {data && data.totalPages > 1 && (
            <p className="text-center text-xs text-muted">{data.total} clientes no total</p>
          )}
        </section>

        {/* Painel lateral */}
        <aside>
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
                Nome completo
                <Input {...register("name")} />
                {errors.name && <span className="text-[10px] text-red">{errors.name.message}</span>}
              </Label>
              <Label>
                CPF / CNPJ
                <Input {...register("document")} placeholder="000.000.000-00" />
                {errors.document && <span className="text-[10px] text-red">{errors.document.message}</span>}
              </Label>
              <Label>
                Telefone
                <Input {...register("phone")} placeholder="(00) 00000-0000" />
              </Label>
              <Label>
                E-mail
                <Input {...register("email")} type="email" placeholder="cliente@email.com" />
                {errors.email && <span className="text-[10px] text-red">{errors.email.message}</span>}
              </Label>

              <Button type="submit" disabled={isSaving}>
                <Save /> {isSaving ? "Salvando..." : "Salvar cliente"}
              </Button>
            </form>
          )}

          {mode === "view" && selected && (
            <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-panel-soft/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase text-muted">Cliente selecionado</span>
                  <strong className="block text-sm text-ink">{selected.name}</strong>
                </div>
                <Badge tone={selected.isBlocked ? "red" : "teal"}>
                  {selected.isBlocked ? <UserX className="size-3" /> : <UserCheck className="size-3" />}
                  {selected.isBlocked ? "Bloqueado" : "Ativo"}
                </Badge>
              </div>

              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Documento</span>
                  <span className="text-ink">{formatDocument(selected.document)}</span>
                </div>
                {selected.phone && (
                  <div className="flex justify-between">
                    <span className="text-muted">Telefone</span>
                    <span className="text-ink">{selected.phone}</span>
                  </div>
                )}
                {selected.email && (
                  <div className="flex justify-between">
                    <span className="text-muted">E-mail</span>
                    <span className="text-ink">{selected.email}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted">Cadastro</span>
                  <span className="text-ink">
                    {new Date(selected.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>

              {selected.isBlocked && selected.blockedReason && (
                <p className="rounded-[8px] bg-red-soft/40 p-2.5 text-xs text-red">
                  Motivo do bloqueio: {selected.blockedReason}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <Button className="flex-1" size="sm" onClick={() => startEdit(selected)}>
                  <Save /> Editar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={deleteClient.isPending}
                  onClick={() => handleDelete(selected.id)}
                >
                  <Trash2 /> Excluir
                </Button>
              </div>
            </div>
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
