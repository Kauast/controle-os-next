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
import { useClients } from "@/hooks/useClients";
import { useCreateServiceOrder } from "@/hooks/useServiceOrders";

const schema = z.object({
  scheduledDate: z.string().min(1, "Informe a data"),
  time: z.string().min(1),
  team: z.string().min(1),
  clientId: z.string().min(1, "Selecione um cliente"),
  priority: z.enum(["NORMAL", "WARNING", "HIGH"]),
  description: z.string().min(2, "Descreva o servico"),
});
type Form = z.infer<typeof schema>;

export function ScheduleDialog() {
  const open = useUIStore((s) => s.scheduleOpen);
  const setOpen = useUIStore((s) => s.setScheduleOpen);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const [clientSearch, setClientSearch] = useState("");

  const { data: clientsData } = useClients(clientSearch);
  const clients = clientsData?.clients ?? [];
  const createOS = useCreateServiceOrder();

  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      scheduledDate: currentDateValue(),
      time: "09:00",
      team: activeTeam,
      clientId: "",
      priority: "NORMAL",
      description: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        scheduledDate: currentDateValue(),
        time: "09:00",
        team: activeTeam,
        clientId: "",
        priority: "NORMAL",
        description: "",
      });
      setClientSearch("");
    }
  }, [open, reset, activeTeam]);

  function submit(data: Form) {
    const dueDate = new Date(`${data.scheduledDate}T${data.time}:00`).toISOString();
    createOS.mutate(
      {
        clientId: data.clientId,
        dueDate,
        team: data.team,
        priority: data.priority,
        scheduledTime: data.time,
        description: data.description,
      },
      {
        onSuccess: () => setOpen(false),
      }
    );
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
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="WARNING">Media</SelectItem>
                <SelectItem value="HIGH">Alta</SelectItem>
              </SelectContent>
            </Select>
          </Label>

          <div className="col-span-2 flex flex-col gap-1">
            <span className="text-sm font-medium">Cliente</span>
            <Input
              placeholder="Buscar cliente..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
            <Select
              value={watch("clientId")}
              onValueChange={(v) => setValue("clientId", v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.city ? ` — ${c.city}` : ""}
                  </SelectItem>
                ))}
                {clients.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    {clientSearch ? "Nenhum cliente encontrado" : "Digite para buscar"}
                  </div>
                )}
              </SelectContent>
            </Select>
            {formState.errors.clientId && (
              <span className="text-[10px] text-red">{formState.errors.clientId.message}</span>
            )}
          </div>

          <Label className="col-span-2">
            Descricao
            <Input {...register("description")} placeholder="Servico a executar" />
          </Label>

          {formState.errors.description && (
            <p className="col-span-2 text-xs text-red">{formState.errors.description.message}</p>
          )}

          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createOS.isPending}>
              {createOS.isPending ? "Agendando..." : "Agendar OS"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
