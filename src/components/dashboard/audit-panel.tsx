"use client";

import { useState } from "react";
import { Shield, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Card, SectionHeading } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuditLogs } from "@/hooks/useUsers";
import { useQueryClient } from "@tanstack/react-query";

const ACTION_LABELS: Record<string, { label: string; tone: "teal" | "amber" | "dark" }> = {
  LOGIN:                  { label: "Login",             tone: "teal"  },
  LOGIN_FALHOU:           { label: "Login falhou",      tone: "amber" },
  USUARIO_CRIADO:         { label: "Usuario criado",    tone: "teal"  },
  USUARIO_ATUALIZADO:     { label: "Usuario editado",   tone: "amber" },
  USUARIO_DESATIVADO:     { label: "Usuario desativado",tone: "dark"  },
  SENHA_REDEFINIDA:       { label: "Senha redefinida",  tone: "amber" },
  SENHA_REDEFINIDA_ADMIN: { label: "Senha (admin)",     tone: "amber" },
  SENHA_RESET_SOLICITADO: { label: "Reset solicitado",  tone: "teal"  },
};

export function AuditPanel() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useAuditLogs(page);
  const qc = useQueryClient();

  const logs   = data?.logs   ?? [];
  const pages  = data?.pages  ?? 1;
  const total  = data?.total  ?? 0;

  return (
    <Card>
      <SectionHeading eyebrow="Seguranca" title="Log de auditoria">
        <Button size="sm" variant="secondary"
          onClick={() => qc.invalidateQueries({ queryKey: ["audit"] })}
          disabled={isFetching}>
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </SectionHeading>

      <p className="text-xs text-muted mb-4">{total} registro{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}</p>

      {isLoading ? (
        <p className="text-xs text-muted py-8 text-center">Carregando...</p>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-muted">
          <Shield className="size-10 opacity-30" />
          <p className="text-sm">Nenhum registro de auditoria ainda.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log) => {
            const meta = ACTION_LABELS[log.action] ?? { label: log.action, tone: "dark" as const };
            return (
              <div key={log.id} className="rounded-[10px] border border-line bg-panel p-3 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {log.userEmail && <span className="text-xs text-muted truncate">{log.userEmail}</span>}
                  </div>
                  {log.detail && <p className="text-xs text-ink/80 mt-0.5">{log.detail}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted">{new Date(log.createdAt).toLocaleString("pt-BR")}</p>
                  {log.ip && <p className="text-[10px] text-muted/60 mt-0.5">{log.ip}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-xs text-muted">{page} / {pages}</span>
          <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </Card>
  );
}
