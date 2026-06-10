"use client";

import { useRouter } from "next/navigation";
import { Download, LogIn, LogOut, Menu, Plus, Search } from "lucide-react";
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
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const user = useAuthStore((s) => s.user);

  const copy = roleViewCopy[role];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Sessão encerrada");
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="h-14 flex items-center justify-between gap-3 border-b border-border bg-background/80 backdrop-blur px-4 lg:px-8 sticky top-0 z-20">
      {/* Left — breadcrumb + mobile menu */}
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="icon"
          size="icon"
          aria-label="Menu"
          className="lg:hidden"
          onClick={() => setMobileSidebarOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
        <nav className="hidden sm:flex items-center gap-2 text-sm min-w-0">
          <span className="text-muted-foreground truncate">{copy.context}</span>
          <span className="text-border">/</span>
          <span className="font-medium text-foreground truncate">{copy.title}</span>
        </nav>
        {/* mobile: just title */}
        <span className="sm:hidden text-sm font-semibold text-foreground truncate">{copy.title}</span>
      </div>

      {/* Right — controls */}
      <div className="flex items-center gap-2 shrink-0">
        {isDev && (
          <Label className="hidden text-[10px] sm:block">
            Perfil (dev)
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="h-8 w-[130px]">
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
              <SelectTrigger className="h-8 w-[110px] sm:w-[130px]">
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
          <Search className="size-4" />
        </Button>

        <Button variant="secondary" className="hidden sm:inline-flex h-8 text-xs">
          <Download className="size-3.5" /> Exportar
        </Button>
        <Button
          variant="secondary"
          className="hidden sm:inline-flex h-8 text-xs"
          onClick={() => setTeamLoginOpen(true)}
        >
          <LogIn className="size-3.5" /> Conta equipe
        </Button>

        {role !== "estoque" && role !== "tecnico" && (
          <Button
            onClick={() => setNewOsOpen(true)}
            className="h-8 text-xs font-semibold bg-amber text-onyx hover:bg-amber/90"
          >
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">Nova OS</span>
          </Button>
        )}

        <span className="hidden rounded-sm bg-muted/60 border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground sm:block">
          {user?.email ?? ROLE_LABELS[role]}
        </span>

        <Button variant="icon" size="icon" aria-label="Sair" onClick={logout}>
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
