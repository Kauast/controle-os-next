"use client";

import { useState, useMemo } from "react";
import { Eye, EyeOff, KeyRound, Pencil, Plus, Search, X } from "lucide-react";
import { Card, SectionHeading } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteButton } from "@/components/ui/delete-button";
import { cn } from "@/lib/utils";
import {
  useUsers, useCreateUser, useUpdateUser, useResetUserPassword, useRemoveUser, type AppUser,
} from "@/hooks/useUsers";

const ROLES = [
  { value: "ADMIN",      label: "Administrador" },
  { value: "SUPERVISOR", label: "Supervisor"    },
  { value: "ATTENDANT",  label: "Atendente"     },
  { value: "TECHNICIAN", label: "Técnico"       },
  { value: "STOCK",      label: "Estoque"       },
  { value: "FINANCIAL",  label: "Financeiro"    },
] as const;

type RoleValue = (typeof ROLES)[number]["value"];

const roleTone: Record<string, "teal" | "amber" | "dark"> = {
  ADMIN:      "dark",
  SUPERVISOR: "teal",
  STOCK:      "amber",
  TECHNICIAN: "teal",
  ATTENDANT:  "teal",
  FINANCIAL:  "amber",
};

const ROLE_DESCS: Record<string, string> = {
  ADMIN:      "Acesso total — usuários, financeiro, estoque, OS, relatórios e auditoria.",
  SUPERVISOR: "Operações e relatórios — OS, agenda, equipes, rastreamento, clientes e relatórios.",
  ATTENDANT:  "Cria/edita OS, agenda equipes, acessa rastreamento.",
  TECHNICIAN: "Vê apenas suas OS, registra execução e solicita materiais.",
  STOCK:      "Cadastra produtos, movimenta estoque e aprova solicitações.",
  FINANCIAL:  "Acessa relatórios financeiros e resumo de OS.",
};

function RoleSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-[10px] border border-line bg-panel px-3 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/40"
    >
      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
    </select>
  );
}

function PasswordInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Mínimo 8 caracteres"}
        className="pr-9"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function CreateUserForm({ onClose }: { onClose: () => void }) {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole]       = useState<RoleValue>("ATTENDANT");
  const create = useCreateUser();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ name: name || undefined, email, password, role });
    onClose();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[12px] border border-teal/20 bg-teal-soft/10 p-4 space-y-3"
    >
      <strong className="block text-sm text-ink">Novo usuário</strong>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="nu-name">Nome</Label>
          <Input id="nu-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo (opcional)" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="nu-email">E-mail</Label>
          <Input id="nu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com" required />
        </div>
        <div className="space-y-1">
          <Label>Senha</Label>
          <PasswordInput value={password} onChange={setPassword} />
        </div>
        <div className="space-y-1">
          <Label>Perfil</Label>
          <RoleSelect value={role} onChange={(v) => setRole(v as RoleValue)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={create.isPending}>
          {create.isPending ? "Criando..." : "Criar usuário"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  );
}

function EditRoleForm({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const [name, setName]     = useState(user.name ?? "");
  const [role, setRole]     = useState(user.role);
  const [active, setActive] = useState(user.active);
  const update = useUpdateUser();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({ id: user.id, name: name || undefined, role, active });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[12px] border border-line bg-panel-soft/40 p-4 space-y-3">
      <strong className="block text-sm text-ink">
        Editar — <span className="font-normal text-muted">{user.email}</span>
      </strong>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1 sm:col-span-1">
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="space-y-1">
          <Label>Perfil</Label>
          <RoleSelect value={role} onChange={setRole} />
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-4 rounded border-line accent-teal"
            />
            Conta ativa
          </label>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={update.isPending}>
          {update.isPending ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  );
}

function ResetPasswordForm({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const reset = useResetUserPassword();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await reset.mutateAsync({ id: user.id, password });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[12px] border border-line bg-panel-soft/40 p-4 space-y-3">
      <strong className="block text-sm text-ink">
        Redefinir senha — <span className="font-normal text-muted">{user.email}</span>
      </strong>
      <div className="max-w-xs space-y-1">
        <Label>Nova senha</Label>
        <PasswordInput value={password} onChange={setPassword} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={reset.isPending}>
          {reset.isPending ? "Salvando..." : "Redefinir"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  );
}

function UserRow({ user }: { user: AppUser }) {
  const [mode, setMode] = useState<"idle" | "edit-role" | "reset-pw">("idle");
  const remove    = useRemoveUser();
  const roleLabel = ROLES.find((r) => r.value === user.role)?.label ?? user.role;

  return (
    <div className="space-y-2">
      <article
        className={cn(
          "rounded-[12px] border border-line bg-panel p-3 transition-colors",
          !user.active && "opacity-50",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {user.name && <span className="text-sm font-semibold text-ink">{user.name}</span>}
              <span className={cn("truncate text-sm", user.name ? "text-muted" : "font-semibold text-ink")}>
                {user.email}
              </span>
              <Badge tone={roleTone[user.role] ?? "dark"}>{roleLabel}</Badge>
              {!user.active && <Badge tone="dark">Inativo</Badge>}
            </div>
            <small className="text-xs text-muted">
              Desde {new Date(user.createdAt).toLocaleDateString("pt-BR")}
            </small>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setMode((m) => (m === "edit-role" ? "idle" : "edit-role"))}
              aria-label="Editar usuário"
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                mode === "edit-role" ? "bg-teal/10 text-teal" : "text-muted hover:bg-panel-soft hover:text-ink",
              )}
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={() => setMode((m) => (m === "reset-pw" ? "idle" : "reset-pw"))}
              aria-label="Redefinir senha"
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                mode === "reset-pw" ? "bg-teal/10 text-teal" : "text-muted hover:bg-panel-soft hover:text-ink",
              )}
            >
              <KeyRound className="size-3.5" />
            </button>
            <DeleteButton compact disabled={remove.isPending} onConfirm={() => remove.mutate(user.id)} />
          </div>
        </div>
      </article>

      {mode === "edit-role" && <EditRoleForm user={user} onClose={() => setMode("idle")} />}
      {mode === "reset-pw"  && <ResetPasswordForm user={user} onClose={() => setMode("idle")} />}
    </div>
  );
}

export function ProfilesPanel() {
  const { data: users = [], isLoading } = useUsers();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch]         = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchSearch = search === "" ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.name?.toLowerCase() ?? "").includes(search.toLowerCase());
      const matchRole   = filterRole === "all" || u.role === filterRole;
      const matchStatus = filterStatus === "all" ||
        (filterStatus === "active" && u.active) ||
        (filterStatus === "inactive" && !u.active);
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, filterRole, filterStatus]);

  return (
    <Card>
      <SectionHeading eyebrow="Controle de acesso" title="Usuários">
        <Button
          size="sm"
          onClick={() => setShowCreate((s) => !s)}
          variant={showCreate ? "secondary" : "primary"}
        >
          {showCreate ? <><X className="size-4" /> Cancelar</> : <><Plus className="size-4" /> Novo usuário</>}
        </Button>
      </SectionHeading>

      {showCreate && <CreateUserForm onClose={() => setShowCreate(false)} />}

      {/* Filter bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="pl-8"
            aria-label="Buscar usuários"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="h-9 rounded-[10px] border border-line bg-panel px-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/40"
          aria-label="Filtrar por perfil"
        >
          <option value="all">Todos os perfis</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 rounded-[10px] border border-line bg-panel px-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/40"
          aria-label="Filtrar por status"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        <span className="text-xs text-muted">{filtered.length} usuário{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-[12px] bg-panel" />
            ))}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <EmptyState
            title="Nenhum usuário encontrado"
            description={search ? "Ajuste os filtros de busca." : "Crie o primeiro usuário do sistema."}
          />
        )}
        {filtered.map((u) => <UserRow key={u.id} user={u} />)}
      </div>

      <div className="mt-6">
        <strong className="mb-3 block text-xs font-semibold uppercase tracking-widest text-muted">
          Referência de perfis
        </strong>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.value} className="rounded-[10px] border border-line bg-panel-soft/40 p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <Badge tone={roleTone[r.value] ?? "dark"}>{r.label}</Badge>
              </div>
              <p className="text-xs text-muted">{ROLE_DESCS[r.value]}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
