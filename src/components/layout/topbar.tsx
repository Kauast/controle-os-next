"use client";

import { useRouter } from "next/navigation";
import { Download, LogIn, LogOut, Plus, Search } from "lucide-react";
import { toast } from "sonner";
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
import { useAuthStore } from "@/store/use-auth-store";
import { useUIStore } from "@/store/use-ui-store";

const ROLES: Role[] = ["admin", "estoque", "tecnico", "atendimento"];
const isDev = process.env.NODE_ENV === "development";

export function Topbar() {
  const router = useRouter();
  const role = useAppStore((s) => s.role);
  const activeTeam = useAppStore((s) => s.activeTeam);
  const setRole = useAppStore((s) => s.setRole);
  const setActiveTeam = useAppStore((s) => s.setActiveTeam);
  const setNewOsOpen = useUIStore((s) => s.setNewOsOpen);
  const setTeamLoginOpen = useUIStore((s) => s.setTeamLoginOpen);
  const user = useAuthStore((s) => s.user);

  const copy = roleViewCopy[role];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Sessão encerrada");
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel/70 px-4 py-3 backdrop-blur lg:px-7 lg:py-4">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted sm:text-xs">{copy.context}</p>
        <h1 className="truncate text-base font-bold text-ink sm:text-xl">{copy.title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Seletor de perfil visível apenas em desenvolvimento */}
        {isDev && (
          <Label className="hidden text-[10px] sm:block">
            Perfil (dev)
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="h-9 w-[130px]">
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
        )}

        {role === "tecnico" && (
          <Label className="text-[10px]">
            Equipe
            <Select value={activeTeam} onValueChange={setActiveTeam}>
              <SelectTrigger className="h-9 w-[110px] sm:w-[130px]">
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

        {/* Botões secundários — visíveis só em telas maiores */}
        <Button variant="secondary" className="hidden sm:inline-flex">
          <Download /> Exportar
        </Button>
        <Button variant="secondary" className="hidden sm:inline-flex" onClick={() => setTeamLoginOpen(true)}>
          <LogIn /> Conta equipe
        </Button>

        {/* Nova OS — visível em mobile também */}
        {role !== "estoque" && role !== "tecnico" && (
          <Button onClick={() => setNewOsOpen(true)}>
            <Plus />
            <span className="hidden sm:inline">Nova OS</span>
          </Button>
        )}

        {/* E-mail do usuário — oculto em mobile */}
        <span className="hidden rounded-full bg-panel-soft px-3 py-1.5 text-xs font-semibold text-muted sm:block">
          {user?.email ?? ROLE_LABELS[role]}
        </span>

        <Button variant="icon" size="icon" aria-label="Sair" onClick={logout}>
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
