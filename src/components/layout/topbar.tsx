"use client";

import { Download, LogIn, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { roleViewCopy } from "@/lib/access";
import { ROLE_LABELS, TEAMS, type Role } from "@/lib/types";
import { useAppStore } from "@/store/use-app-store";
import { useUIStore } from "@/store/use-ui-store";

const ROLES: Role[] = ["admin", "estoque", "tecnico", "atendimento"];

export function Topbar() {
  const role = useAppStore((s) => s.role);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const activeAccount = useAppStore((s) => s.activeTeamAccount);
  const setRole = useAppStore((s) => s.setRole);
  const setActiveTeam = useAppStore((s) => s.setActiveTeam);
  const setNewOsOpen = useUIStore((s) => s.setNewOsOpen);
  const setTeamLoginOpen = useUIStore((s) => s.setTeamLoginOpen);

  const copy = roleViewCopy[role];
  const accountLabel = activeAccount
    ? `${activeAccount.team} logada`
    : role === "admin"
      ? "Administrador"
      : ROLE_LABELS[role];

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-panel/70 px-5 py-4 backdrop-blur lg:px-7">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{copy.context}</p>
        <h1 className="text-xl font-bold text-ink">{copy.title}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Label className="text-[10px]">
          Perfil
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Label>

        {role === "tecnico" && (
          <Label className="text-[10px]">
            Equipe
            <Select value={activeTeam} onValueChange={setActiveTeam}>
              <SelectTrigger className="h-9 w-[130px]">
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
        )}

        <Button variant="icon" size="icon" aria-label="Pesquisar">
          <Search />
        </Button>
        <Button variant="secondary">
          <Download /> Exportar
        </Button>
        <Button variant="secondary" onClick={() => setTeamLoginOpen(true)}>
          <LogIn /> Conta equipe
        </Button>
        {role !== "estoque" && role !== "tecnico" && (
          <Button onClick={() => setNewOsOpen(true)}>
            <Plus /> Nova OS
          </Button>
        )}
        <span className="rounded-full bg-panel-soft px-3 py-1.5 text-xs font-semibold text-muted">
          {accountLabel}
        </span>
      </div>
    </header>
  );
}
