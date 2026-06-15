"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TEAMS } from "@/lib/types";
import { cn, tomorrowDate } from "@/lib/utils";
import { useUIStore } from "@/store/use-ui-store";
import { useClients } from "@/hooks/useClients";
import { useDebounce } from "@/hooks/useDebounce";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useCreateServiceOrder } from "@/hooks/useServiceOrders";

const schema = z.object({
  clientId: z.string().min(1, "Selecione um cliente"),
  description: z.string().min(2, "Descreva o servico"),
  priority: z.enum(["NORMAL", "WARNING", "HIGH"]),
  scheduledTime: z.string().min(1, "Informe o horario"),
  team: z.string().min(1),
  technicianId: z.string().optional(),
  dueDate: z.string().min(1, "Informe o prazo"),
});
type Form = z.infer<typeof schema>;

const steps = ["Cliente", "Servico", "Agenda", "Revisao"];
const stepFields: Record<number, (keyof Form)[]> = {
  1: ["clientId"],
  2: ["description", "priority"],
  3: ["scheduledTime", "team", "dueDate"],
};

export function NewOsDialog() {
  const open = useUIStore((s) => s.newOsOpen);
  const setOpen = useUIStore((s) => s.setNewOsOpen);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  const debouncedClientSearch = useDebounce(clientSearch, 400);
  const { data: clientsData } = useClients(debouncedClientSearch);
  const clients = clientsData?.clients ?? [];
  const { data: technicians = [] } = useTechnicians();
  const createOS = useCreateServiceOrder();

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: "",
      description: "",
      scheduledTime: "09:00",
      team: "Sem equipe",
      technicianId: "",
      priority: "NORMAL",
      dueDate: tomorrowDate(),
    },
  });
  const { handleSubmit, setValue, watch, reset, formState, trigger } = form;

  useEffect(() => {
    if (open) {
      reset({
        clientId: "",
        description: "",
        scheduledTime: "09:00",
        team: "Sem equipe",
        technicianId: "",
        priority: "NORMAL",
        dueDate: tomorrowDate(),
      });
      setStep(1);
      setError("");
      setClientSearch("");
    }
  }, [open, reset]);

  async function next() {
    const valid = await trigger(stepFields[step] ?? []);
    if (valid) setStep((s) => Math.min(4, s + 1));
  }

  async function submit(data: Form) {
    setError("");
    try {
      await createOS.mutateAsync({
        clientId: data.clientId,
        description: data.description,
        priority: data.priority,
        scheduledTime: data.scheduledTime,
        team: data.team,
        technicianId: data.technicianId || undefined,
        dueDate: new Date(`${data.dueDate}T23:59:59`).toISOString(),
        items: [],
      });
      setOpen(false);
    } catch (e: unknown) {
      const axiosMsg =
        (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data
          ?.error ??
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(axiosMsg ?? (e instanceof Error ? e.message : "Erro ao criar OS."));
    }
  }

  const selectedClient = clients.find((c) => c.id === watch("clientId"));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader eyebrow="Cadastro guiado" title="Nova OS" />

        <div className="flex gap-2">
          {steps.map((label, i) => (
            <div
              key={label}
              className={cn(
                "relative flex-1 rounded-full px-2 py-1.5 text-center text-[11px] font-semibold",
                i + 1 === step
                  ? "bg-teal text-white"
                  : i + 1 < step
                    ? "bg-teal-soft text-teal"
                    : "bg-panel-soft text-muted",
              )}
            >
              {i + 1} {label}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
          <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
            {step === 1 && (
              <div className="grid gap-3">
                <Label>
                  Buscar cliente
                  <Input
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Nome ou documento..."
                  />
                </Label>
                <Label>
                  Cliente
                  <Select
                    value={watch("clientId")}
                    onValueChange={(v) => setValue("clientId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} — {c.document}
                        </SelectItem>
                      ))}
                      {clients.length === 0 && (
                        <SelectItem value="_none" disabled>
                          Nenhum cliente encontrado
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {formState.errors.clientId && (
                    <span className="text-[10px] text-red">{formState.errors.clientId.message}</span>
                  )}
                </Label>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-3">
                <Label>
                  Descricao do servico
                  <Input {...form.register("description")} placeholder="Servico solicitado" />
                  {formState.errors.description && (
                    <span className="text-[10px] text-red">{formState.errors.description.message}</span>
                  )}
                </Label>
                <Label>
                  Prioridade
                  <Select
                    value={watch("priority")}
                    onValueChange={(v) => setValue("priority", v as Form["priority"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="WARNING">Media</SelectItem>
                      <SelectItem value="HIGH">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </Label>
              </div>
            )}

            {step === 3 && (
              <div className="grid grid-cols-2 gap-3">
                <Label>
                  Horario agendado
                  <Input type="time" {...form.register("scheduledTime")} />
                </Label>
                <Label>
                  Prazo
                  <Input type="date" {...form.register("dueDate")} min={tomorrowDate()} />
                </Label>
                <Label>
                  Equipe
                  <Select value={watch("team")} onValueChange={(v) => setValue("team", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sem equipe">Sem equipe</SelectItem>
                      {TEAMS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Label>
                <Label>
                  Tecnico
                  <Select
                    value={watch("technicianId") ?? ""}
                    onValueChange={(v) => setValue("technicianId", v === "_none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhum</SelectItem>
                      {technicians.map((t) => {
                        const apiId = (t as { _apiId?: string })._apiId ?? String(t.id);
                        return (
                          <SelectItem key={apiId} value={apiId}>
                            {t.name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </Label>
              </div>
            )}

            {step === 4 && (
              <div className="rounded-[12px] border border-line bg-panel-soft/50 p-3 text-sm">
                <strong className="block text-ink">Revise antes de salvar</strong>
                <p className="mt-1 text-xs text-muted">
                  <strong>Cliente:</strong> {selectedClient?.name ?? watch("clientId")}
                </p>
                <p className="text-xs text-muted">
                  <strong>Servico:</strong> {watch("description")}
                </p>
                <p className="text-xs text-muted">
                  <strong>Equipe:</strong> {watch("team")} · {watch("scheduledTime")}
                </p>
                <p className="text-xs text-muted">
                  <strong>Prazo:</strong> {watch("dueDate")} · <strong>Prioridade:</strong>{" "}
                  {{ NORMAL: "Normal", WARNING: "Média", HIGH: "Alta" }[watch("priority")] ?? watch("priority")}
                </p>
              </div>
            )}
          </motion.div>

          {error && <p className="text-xs text-red">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            {step > 1 && (
              <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
                Voltar
              </Button>
            )}
            {step < 4 ? (
              <Button type="button" onClick={next}>
                Proximo
              </Button>
            ) : (
              <Button type="submit" disabled={createOS.isPending}>
                {createOS.isPending ? "Salvando..." : "Adicionar OS"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
