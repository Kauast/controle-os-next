"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Pencil, Plus, X } from "lucide-react";
import { Card, SectionHeading } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteButton } from "@/components/ui/delete-button";
import { cn } from "@/lib/utils";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useResetUserPassword,
  useRemoveUser,
  type AppUser,
} from "@/hooks/useUsers";

/* ── constantes ── */

const ROLES = [
  { value: "ADMIN",      label: "Administrador" },
  { value: "ATTENDANT",  label: "Atendente"     },
  { value: "TECHNICIAN", label: "Técnico"        },
  { value: "STOCK",      label: "Estoque"        },
  { value: "FINANCIAL",  label: "Financeiro"     },
] as const;

type RoleValue = (typeof ROLES)[number]["value"];

const roleTone: Record<string, "teal" | "amber" | "dark"> = {
  ADMIN:      "dark",
  STOCK:      "amber",
  TECHNICIAN: "teal",
  ATTENDANT:  "teal",
  FINANCIAL:  "amber",
};

const ROLE_DESCS: Record<string, string> = {
  ADMIN:      "Acesso total — usuários, financeiro, estoque, OS e relatórios.",
  ATTENDANT:  "Cria/edita OS, agenda equipes, acessa rastreamento.",
  TECHNICIAN: "Vê apenas suas OS, registra execução e solicita materiais.",
  STOCK:      "Cadastra produtos, movimenta estoque e aprova solicitações.",
  FINANCIAL:  "Acessa relatórios financeiros e resumo de OS.",
};

/* ── tipos de formulário ── */

type Mode = "idle" | "create" | "edit-role" | "reset-pw";

/* ── RoleSelect ── */

function RoleSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-[10px] border border-line bg-panel px-3 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal/40"
    >
      {ROLES.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

/* ── PasswordInput ── */

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/* ── CreateUserForm ── */

function CreateUserForm({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleValue>("ATTENDANT");
  const create = useCreateUser();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ email, password, role });
    onClose();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[12px] border border-line bg-panel-soft/40 p-4 space-y-3"
    >
      <strong className="block text-sm text-ink">Novo usuário</strong>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1 sm:col-span-1">
          <Label htmlFor="nu-email">E-mail</Label>
          <Input
            id="nu-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@empresa.com"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="nu-pw">Senha</Label>
          <PasswordInput value={password} onChange={setPassword} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="nu-role">Perfil</Label>
          <RoleSelect value={role} onChange={(v) => setRole(v as RoleValue)} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={create.isPending}>
          {create.isPending ? "Criando…" : "Criar usuário"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/* ── EditRoleForm ── */

function EditRoleForm({
  user,
  onClose,
}: {
  user: AppUser;
  onClose: () => void;
}) {
  const [role, setRole] = useState(user.role);
  const [active, setActive] = useState(user.active);
  const update = useUpdateUser();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({ id: user.id, role, active });
    onClose();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[12px] border border-line bg-panel-soft/40 p-4 space-y-3"
    >
      <strong className="block text-sm text-ink">
        Editar perfil — <span className="text-muted font-normal">{user.email}</span>
      </strong>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Perfil</Label>
          <RoleSelect value={role} onChange={setRole} />
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <label className="flex items-center gap-2 h-9 text-sm cursor-pointer">
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
          {update.isPending ? "Salvando…" : "Salvar"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/* ── ResetPasswordForm ── */

function ResetPasswordForm({
  user,
  onClose,
}: {
  user: AppUser;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const reset = useResetUserPassword();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await reset.mutateAsync({ id: user.id, password });
    onClose();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[12px] border border-line bg-panel-soft/40 p-4 space-y-3"
    >
      <strong className="block text-sm text-ink">
        Redefinir senha — <span className="text-muted font-normal">{user.email}</span>
      </strong>

      <div className="max-w-xs space-y-1">
        <Label>Nova senha</Label>
        <PasswordInput value={password} onChange={setPassword} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={reset.isPending}>
          {reset.isPending ? "Salvando…" : "Redefinir"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/* ── UserRow ── */

function UserRow({ user }: { user: AppUser }) {
  const [mode, setMode] = useState<"idle" | "edit-role" | "reset-pw">("idle");
  const remove = useRemoveUser();

  const roleLabel = ROLES.find((r) => r.value === user.role)?.label ?? user.role;

  return (
    <div className="space-y-2">
      <article
        className={cn(
          "rounded-[10px] border border-line bg-panel p-3 transition-colors",
          !user.active && "opacity-60",
        )}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-ink truncate">
                {user.email}
              </span>
              <Badge tone={roleTone[user.role] ?? "dark"}>{roleLabel}</Badge>
              {!user.active && (
                <Badge tone="dark">Inativo</Badge>
              )}
            </div>
            <small className="text-xs text-muted">
              Desde {new Date(user.createdAt).toLocaleDateString("pt-BR")}
            </small>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setMode((m) => (m === "edit-role" ? "idle" : "edit-role"))}
              title="Editar perfil"
              className={cn(
                "rounded p-1.5 transition-colors",
                mode === "edit-role"
                  ? "text-teal bg-teal/10"
                  : "text-muted hover:text-ink hover:bg-panel-soft",
              )}
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={() => setMode((m) => (m === "reset-pw" ? "idle" : "reset-pw"))}
              title="Redefinir senha"
              className={cn(
                "rounded p-1.5 transition-colors",
                mode === "reset-pw"
                  ? "text-teal bg-teal/10"
                  : "text-muted hover:text-ink hover:bg-panel-soft",
              )}
            >
              <KeyRound className="size-3.5" />
            </button>
            <DeleteButton
              compact
              disabled={remove.isPending}
              onConfirm={() => remove.mutate(user.id)}
            />
          </div>
        </div>
      </article>

      {mode === "edit-role" && (
        <EditRoleForm user={user} onClose={() => setMode("idle")} />
      )}
      {mode === "reset-pw" && (
        <ResetPasswordForm user={user} onClose={() => setMode("idle")} />
      )}
    </div>
  );
}

/* ── ProfilesPanel ── */

export function ProfilesPanel() {
  const { data: users = [], isLoading } = useUsers();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <Card>
      <SectionHeading eyebrow="Controle de acesso" title="Usuários do sistema">
        <Button
          size="sm"
          onClick={() => setShowCreate((s) => !s)}
          variant={showCreate ? "secondary" : "primary"}
        >
          {showCreate ? (
            <>
              <X /> Cancelar
            </>
          ) : (
            <>
              <Plus /> Novo usuário
            </>
          )}
        </Button>
      </SectionHeading>

      {showCreate && <CreateUserForm onClose={() => setShowCreate(false)} />}

      {/* User list */}
      <div className="mt-4 space-y-2">
        {isLoading && (
          <p className="text-xs text-muted py-4 text-center">Carregando…</p>
        )}
        {!isLoading && users.length === 0 && (
          <p className="text-xs text-muted py-4 text-center">
            Nenhum usuário cadastrado.
          </p>
        )}
        {users.map((u) => (
          <UserRow key={u.id} user={u} />
        ))}
      </div>

      {/* Role reference */}
      <div className="mt-6">
        <strong className="mb-3 block text-xs text-muted uppercase tracking-widest">
          Referência de perfis
        </strong>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {ROLES.map((r) => (
            <div
              key={r.value}
              className="rounded-[10px] border border-line bg-panel-soft/40 p-3"
            >
              <div className="flex items-center gap-1.5 mb-1">
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
