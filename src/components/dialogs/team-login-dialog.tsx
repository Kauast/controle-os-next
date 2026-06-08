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
import { teamAccounts, useAppStore } from "@/store/use-app-store";
import { useUIStore } from "@/store/use-ui-store";

const schema = z.object({
  team: z.string().min(1),
  user: z.string().min(1, "Informe o usuario"),
  password: z.string().min(1, "Informe a senha"),
});
type Form = z.infer<typeof schema>;

export function TeamLoginDialog() {
  const open = useUIStore((s) => s.teamLoginOpen);
  const setOpen = useUIStore((s) => s.setTeamLoginOpen);
  const loginTeam = useAppStore((s) => s.loginTeam);
  const [error, setError] = useState("");

  const { register, handleSubmit, reset, setValue, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { team: "Equipe 1", user: "", password: "" },
  });

  const team = watch("team");
  const account = teamAccounts.find((a) => a.team === team);

  useEffect(() => {
    if (open) {
      reset({ team: "Equipe 1", user: "", password: "" });
      setError("");
    }
  }, [open, reset]);

  function submit(data: Form) {
    const acc = teamAccounts.find((a) => a.team === data.team);
    if (!acc || data.user.trim().toLowerCase() !== acc.user || data.password !== acc.password) {
      setError("Usuario ou senha da equipe incorretos.");
      return;
    }
    loginTeam(acc.team);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader eyebrow="Acesso por equipe" title="Conta da equipe" />
        <form onSubmit={handleSubmit(submit)} className="grid gap-3">
          <Label>
            Equipe
            <Select value={team} onValueChange={(v) => setValue("team", v)}>
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
            Usuario
            <Input {...register("user")} autoComplete="username" />
          </Label>
          <Label>
            Senha
            <Input type="password" {...register("password")} autoComplete="current-password" />
          </Label>
          <div className="rounded-[10px] bg-panel-soft p-3 text-xs text-muted">
            <strong className="text-ink">Senha inicial</strong>
            <p>
              {account?.team}: usuario {account?.user}, senha {account?.password}
            </p>
          </div>
          {error && <p className="text-xs text-red">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Entrar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
