"use client";

import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Card, SectionHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TEAMS, type Technician } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTechnicians, useUpdateTechnician, useDeactivateTechnician } from "@/hooks/useTechnicians";

const STATUSES = [
  "Disponivel",
  "A caminho",
  "Em atendimento",
  "Checklist final",
  "Redirecionado",
  "Offline",
];

const empty: Omit<Technician, "id"> = { name: "", phone: "", status: "Disponivel", team: "Equipe 1" };

export function TeamsPanel() {
  const { data: technicians = [], isLoading } = useTechnicians();
  const updateTechnician = useUpdateTechnician();
  const deactivateTechnician = useDeactivateTechnician();

  const [editingApiId, setEditingApiId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Technician, "id">>(empty);

  function select(tech: Technician & { _apiId?: string }) {
    setEditingApiId(tech._apiId ?? null);
    setForm({ name: tech.name, phone: tech.phone, status: tech.status, team: tech.team });
  }

  function newTech() {
    setEditingApiId(null);
    setForm(empty);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !editingApiId) return;
    updateTechnician.mutate({
      apiId: editingApiId,
      name: form.name,
      phone: form.phone,
      team: form.team,
      statusField: form.status,
    });
  }

  if (isLoading) {
    return (
      <Card>
        <div className="py-16 text-center text-sm text-muted">Carregando técnicos...</div>
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeading eyebrow="Campo" title="Status das equipes e tecnicos" />

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-5">
        {TEAMS.map((team) => {
          const techs = technicians.filter((t) => t.team === team);
          const status = techs.find((t) => t.status !== "Disponivel")?.status ?? "Disponivel";
          return (
            <div key={team} className="rounded-[12px] border border-line bg-panel-soft/40 p-3">
              <strong className="text-sm text-ink">{team}</strong>
              <span className="mt-1 block text-xs text-muted">{status}</span>
              <small className="text-[11px] text-muted">
                {techs.map((t) => t.name).join(", ") || "Sem tecnico"}
              </small>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="rounded-[14px] border border-line bg-panel-soft/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <span className="text-xs uppercase text-muted">Tecnicos cadastrados</span>
              <strong className="block text-sm text-ink">{technicians.length} ativos</strong>
            </div>
            <Button variant="ghost" size="sm" onClick={newTech}>
              <Plus /> Novo
            </Button>
          </div>
          {technicians.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">
              Nenhum técnico cadastrado. Crie tecnicos pelo painel de Usuarios.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {technicians.map((t) => (
              <button
                key={t._apiId ?? t.id}
                onClick={() => select(t)}
                className={cn(
                  "flex items-center justify-between rounded-[10px] border border-line bg-panel p-3 text-left transition-colors hover:border-teal/50",
                  editingApiId === t._apiId && "border-teal bg-teal-soft/40",
                )}
              >
                <span>
                  <strong className="block text-sm text-ink">{t.name}</strong>
                  <small className="text-xs text-muted">{t.phone || "Sem telefone"}</small>
                </span>
                <span className="text-right">
                  <strong className="block text-sm text-ink">{t.team}</strong>
                  <Badge tone={t.status === "Disponivel" ? "teal" : "amber"}>{t.status}</Badge>
                </span>
              </button>
            ))}
          </div>
        </section>

        <form onSubmit={submit} className="flex flex-col gap-3 rounded-[14px] border border-line bg-panel-soft/40 p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs uppercase text-muted">Edicao rapida</span>
              <strong className="block text-sm text-ink">{form.name || "Selecione um tecnico"}</strong>
            </div>
            <Badge tone={editingApiId ? "teal" : "amber"}>{editingApiId ? "Selecionado" : "Nenhum"}</Badge>
          </div>
          {!editingApiId && (
            <p className="text-xs text-muted">Selecione um técnico na lista para editar.</p>
          )}
          {editingApiId && (
            <>
              <Label>
                Nome do tecnico
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Label>
              <Label>
                Telefone
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Label>
              <Label>
                Status
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
              <Label>
                Equipe
                <Select value={form.team} onValueChange={(v) => setForm({ ...form, team: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAMS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={updateTechnician.isPending}>
                  <Save /> Salvar
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={deactivateTechnician.isPending}
                  onClick={() => {
                    if (editingApiId) {
                      deactivateTechnician.mutate(editingApiId, {
                        onSuccess: () => newTech(),
                      });
                    }
                  }}
                >
                  <Trash2 /> Desativar
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </Card>
  );
}
