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
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import { useUIStore } from "@/store/use-ui-store";

const schema = z.object({
  code: z.string().min(1),
  client: z.string().min(2, "Informe o cliente"),
  description: z.string().min(2, "Descreva o servico"),
  time: z.string().min(1, "Informe o horario"),
  team: z.string().min(1),
  tech: z.string().optional(),
  priority: z.enum(["normal", "warning", "high"]),
  status: z.enum(["pending", "scheduled", "completed"]),
});
type Form = z.infer<typeof schema>;

const steps = ["Cliente", "Servico", "Agenda", "Revisao"];
const stepFields: Record<number, (keyof Form)[]> = {
  1: ["client"],
  2: ["description", "priority"],
  3: ["time", "team", "tech"],
};

export function NewOsDialog() {
  const open = useUIStore((s) => s.newOsOpen);
  const setOpen = useUIStore((s) => s.setNewOsOpen);
  const orders = useAppStore((s) => s.orders);
  const addOrder = useAppStore((s) => s.addOrder);
  const nextOrderCode = useAppStore((s) => s.nextOrderCode);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
      client: "",
      description: "",
      time: "09:00",
      team: "Sem equipe",
      tech: "",
      priority: "normal",
      status: "pending",
    },
  });
  const { register, handleSubmit, setValue, watch, reset, formState, trigger } = form;

  useEffect(() => {
    if (open) {
      reset();
      setValue("code", nextOrderCode());
      setStep(1);
      setError("");
    }
  }, [open, reset, setValue, nextOrderCode]);

  async function next() {
    const valid = await trigger(stepFields[step] ?? []);
    if (valid) setStep((s) => Math.min(4, s + 1));
  }

  function submit(data: Form) {
    if (orders.some((o) => o.code === data.code.toUpperCase())) {
      setError("Ja existe uma OS com esse numero.");
      return;
    }
    addOrder({ ...data, code: data.code.toUpperCase(), tech: data.tech ?? "" });
    setOpen(false);
  }

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
              <Label>
                Cliente
                <Input {...register("client")} placeholder="Nome do cliente" />
                {formState.errors.client && (
                  <span className="text-[10px] text-red">{formState.errors.client.message}</span>
                )}
              </Label>
            )}

            {step === 2 && (
              <div className="grid gap-3">
                <Label>
                  Descricao
                  <Input {...register("description")} placeholder="Servico solicitado" />
                  {formState.errors.description && (
                    <span className="text-[10px] text-red">
                      {formState.errors.description.message}
                    </span>
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
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="warning">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </Label>
              </div>
            )}

            {step === 3 && (
              <div className="grid grid-cols-2 gap-3">
                <Label>
                  Horario
                  <Input type="time" {...register("time")} />
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
                <Label className="col-span-2">
                  Tecnico
                  <Input {...register("tech")} placeholder="Responsavel" />
                </Label>
              </div>
            )}

            {step === 4 && (
              <div className="grid gap-3">
                <div className="rounded-[12px] border border-line bg-panel-soft/50 p-3 text-sm">
                  <strong className="block text-ink">Revise antes de salvar</strong>
                  <p className="mt-1 text-xs text-muted">
                    {watch("code")} · {watch("client")} · {watch("description")} · {watch("team")} ·{" "}
                    {watch("time")} · {watch("priority")}
                  </p>
                </div>
                <Label>
                  Status
                  <Select
                    value={watch("status")}
                    onValueChange={(v) => setValue("status", v as Form["status"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="scheduled">Agendada</SelectItem>
                      <SelectItem value="completed">Concluida</SelectItem>
                    </SelectContent>
                  </Select>
                </Label>
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
              <Button type="submit">Adicionar OS</Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
