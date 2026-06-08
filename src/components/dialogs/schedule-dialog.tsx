"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { currentDateValue } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import { useUIStore } from "@/store/use-ui-store";

const schema = z.object({
  code: z.string().min(1),
  scheduledDate: z.string().min(1, "Informe a data"),
  time: z.string().min(1),
  team: z.string().min(1),
  client: z.string().min(2, "Informe o cliente"),
  tech: z.string().optional(),
  priority: z.enum(["normal", "warning", "high"]),
  description: z.string().min(2, "Descreva o servico"),
});
type Form = z.infer<typeof schema>;

export function ScheduleDialog() {
  const open = useUIStore((s) => s.scheduleOpen);
  const setOpen = useUIStore((s) => s.setScheduleOpen);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const orders = useAppStore((s) => s.orders);
  const addOrder = useAppStore((s) => s.addOrder);
  const nextOrderCode = useAppStore((s) => s.nextOrderCode);
  const [error, setError] = useState("");

  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
      scheduledDate: currentDateValue(),
      time: "09:00",
      team: activeTeam,
      client: "",
      tech: "",
      priority: "normal",
      description: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        code: nextOrderCode(),
        scheduledDate: currentDateValue(),
        time: "09:00",
        team: activeTeam,
        client: "",
        tech: "",
        priority: "normal",
        description: "",
      });
      setError("");
    }
  }, [open, reset, nextOrderCode, activeTeam]);

  function submit(data: Form) {
    const code = data.code.toUpperCase();
    if (orders.some((o) => o.code === code)) {
      setError("Ja existe uma OS com esse numero.");
      return;
    }
    addOrder({
      ...data,
      code,
      tech: data.tech ?? "",
      status: "scheduled",
      scheduledMonth: data.scheduledDate.slice(0, 7),
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader eyebrow="Agenda mensal" title="Agendar OS" />
        <form onSubmit={handleSubmit(submit)} className="grid grid-cols-2 gap-3">
          <Label>
            Data do atendimento
            <Input type="date" {...register("scheduledDate")} />
          </Label>
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
                {TEAMS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Label>
            Cliente
            <Input {...register("client")} placeholder="Nome do cliente" />
          </Label>
          <Label>
            Tecnico
            <Input {...register("tech")} placeholder="Responsavel" />
          </Label>
          <Label className="col-span-2">
            Descricao
            <Input {...register("description")} placeholder="Servico a executar" />
          </Label>

          {(formState.errors.client || formState.errors.description || formState.errors.scheduledDate) && (
            <p className="col-span-2 text-xs text-red">Preencha os campos obrigatorios.</p>
          )}
          {error && <p className="col-span-2 text-xs text-red">{error}</p>}

          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Agendar OS</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
