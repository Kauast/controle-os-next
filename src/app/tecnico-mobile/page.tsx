"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  AlertCircle,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  LogOut,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  User,
  Wifi,
  WifiOff,
  Wrench,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { SignaturePad } from "@/components/tecnico/signature-pad";
import { cn } from "@/lib/utils";
import { capturePhoto } from "@/lib/mobile/camera";
import { getCurrentLocation, buildMapsUrl } from "@/lib/mobile/geo";
import { getNetworkStatus, listenNetworkChanges } from "@/lib/mobile/network";
import { getPendingCount, syncQueue, clearDoneItems } from "@/lib/mobile/offline-queue";
import {
  initMobileAuth,
  removeMobileToken,
  mobileApiClient,
} from "@/lib/api/mobile-client";
import {
  useCurrentUserMobile,
  useTechnicianOrders,
  useCheckin,
  useUpdateExecution,
  useCompleteOS,
  uploadPhotoBlob,
  uploadSignatureDataUrl,
  type MobileServiceOrder,
} from "@/hooks/useServiceOrdersMobile";

// ─── Foto state ───────────────────────────────────────────────────────────────

interface PhotoSlotState {
  /** dataUrl local para preview imediato (nao e enviado ao servidor). */
  preview: string | null;
  /** attachmentId retornado pelo backend apos upload bem-sucedido. */
  attachmentId: string | null;
  uploading: boolean;
  error: boolean;
}

const EMPTY_PHOTO: PhotoSlotState = {
  preview: null,
  attachmentId: null,
  uploading: false,
  error: false,
};

// ─── Status config (Badge + ícone lucide) ────────────────────────────────────

type BadgeTone = "blue" | "amber" | "orange" | "teal" | "red";

const STATUS_CONFIG: Record<
  MobileServiceOrder["status"],
  { text: string; tone: BadgeTone; icon: React.ReactNode }
> = {
  OPEN:          { text: "Aberta",           tone: "blue",   icon: <Clock /> },
  IN_PROGRESS:   { text: "Em andamento",     tone: "amber",  icon: <Wrench /> },
  WAITING_PARTS: { text: "Aguardando peças", tone: "orange", icon: <Package /> },
  COMPLETED:     { text: "Concluída",        tone: "teal",   icon: <CheckCircle2 /> },
  CANCELLED:     { text: "Cancelada",        tone: "red",    icon: <XCircle /> },
};

const PRIORITY_LABEL: Record<MobileServiceOrder["priority"], string> = {
  NORMAL: "Normal",
  WARNING: "Atenção",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

type PriorityBadgeTone = "amber" | "orange" | "red";
const PRIORITY_BADGE: Record<
  Exclude<MobileServiceOrder["priority"], "NORMAL">,
  { tone: PriorityBadgeTone; label: string }
> = {
  WARNING:  { tone: "amber",  label: "Atenção" },
  HIGH:     { tone: "orange", label: "Alta" },
  CRITICAL: { tone: "red",    label: "Crítica" },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-[var(--radius-md)]", className)} />;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TecnicoMobilePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  // Verifica autenticação e inicializa o cliente
  useEffect(() => {
    initMobileAuth().then((token) => {
      if (!token) {
        router.replace("/tecnico-mobile/login/");
        setAuthed(false);
      } else {
        setAuthed(true);
      }
    });
  }, [router]);

  // Status de rede
  useEffect(() => {
    getNetworkStatus().then((s) => setIsOnline(s !== "offline"));
    const unsub = listenNetworkChanges((s) => setIsOnline(s !== "offline"));
    return unsub;
  }, []);

  // Atualiza contador de pendentes
  useEffect(() => {
    const update = () => setPendingSync(getPendingCount());
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, []);

  // Sincroniza fila quando voltar online
  useEffect(() => {
    if (!isOnline) return;
    if (getPendingCount() === 0) return;
    setIsSyncing(true);
    syncQueue(mobileApiClient)
      .then(({ synced, failed }) => {
        clearDoneItems();
        setPendingSync(getPendingCount());
        if (synced > 0) toast.success(`${synced} ação(ões) sincronizadas.`);
        if (failed > 0) toast.error(`${failed} ação(ões) falharam ao sincronizar.`);
      })
      .finally(() => setIsSyncing(false));
  }, [isOnline]);

  const { data: me, isLoading: meLoading } = useCurrentUserMobile();
  const technicianId = me?.technician?.id ?? null;

  const {
    data: orders = [],
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = useTechnicianOrders(technicianId);

  // OS activa: a primeira não finalizada/cancelada
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const activeOrder =
    orders.find((o) => o.id === activeOrderId) ??
    orders.find((o) => o.status === "IN_PROGRESS" || o.status === "OPEN");

  // ─── Execution state ────────────────────────────────────────────────────────
  const [photos, setPhotos] = useState<[PhotoSlotState, PhotoSlotState, PhotoSlotState]>([
    EMPTY_PHOTO,
    EMPTY_PHOTO,
    EMPTY_PHOTO,
  ]);
  const [signature, setSignature] = useState<{
    preview: string | null;
    /** attachmentId retornado pelo backend apos upload da assinatura. */
    attachmentId: string | null;
    uploading: boolean;
  }>({ preview: null, attachmentId: null, uploading: false });
  const [chipDraft, setChipDraft] = useState("");
  const [chipConfirmed, setChipConfirmed] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  // Sincroniza state local quando OS muda
  useEffect(() => {
    if (!activeOrder) return;
    const exec = activeOrder.execution;
    setCheckedIn(!!exec?.checkinAt);
    if (activeOrder.chipIccid) {
      setChipConfirmed(activeOrder.chipIccid);
      setChipDraft(activeOrder.chipIccid);
    } else {
      setChipConfirmed(null);
      setChipDraft("");
    }
    // Reconstroi fotos a partir dos attachmentIds salvos no backend
    const savedIds = exec?.photoAttachmentIds ?? [];
    if (savedIds.length) {
      setPhotos(
        savedIds.slice(0, 3).concat(Array(3).fill(null)).slice(0, 3).map((id: string | null) =>
          id ? { ...EMPTY_PHOTO, attachmentId: id, preview: null } : EMPTY_PHOTO
        ) as [PhotoSlotState, PhotoSlotState, PhotoSlotState]
      );
    } else {
      setPhotos([EMPTY_PHOTO, EMPTY_PHOTO, EMPTY_PHOTO]);
    }
    if (exec?.signatureAttachmentId) {
      setSignature({ preview: null, attachmentId: exec.signatureAttachmentId, uploading: false });
    } else {
      setSignature({ preview: null, attachmentId: null, uploading: false });
    }
  }, [activeOrder?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chaves estáveis para disparar o efeito de preview apenas quando os IDs mudam
  const photoAttachmentKey = useMemo(
    () => photos.map((p) => p.attachmentId ?? "").join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [photos[0].attachmentId, photos[1].attachmentId, photos[2].attachmentId]
  );
  const signatureAttachmentId = signature.attachmentId;

  // Carrega previews para attachmentIds sem preview (após reload)
  useEffect(() => {
    // Object URLs criadas neste efeito — precisam ser revogadas no cleanup
    const objectUrls: string[] = [];

    const loadPhotoPreview = async (id: string, idx: number) => {
      try {
        const res = await mobileApiClient.get<Blob>(`/attachments/${id}/download`, {
          responseType: "blob",
        });
        const url = URL.createObjectURL(res.data);
        objectUrls.push(url);
        setPhotos((prev) => {
          const next = [...prev] as typeof prev;
          // Só aplica se o slot ainda tem o mesmo attachmentId e preview ainda nulo
          if (next[idx].attachmentId === id && next[idx].preview === null) {
            next[idx] = { ...next[idx], preview: url };
          }
          return next;
        });
      } catch {
        // Falha silenciosa: mantém o badge de "enviado" (checkmark) sem preview
      }
    };

    const loadSignaturePreview = async (id: string) => {
      try {
        const res = await mobileApiClient.get<Blob>(`/attachments/${id}/download`, {
          responseType: "blob",
        });
        const url = URL.createObjectURL(res.data);
        objectUrls.push(url);
        setSignature((prev) => {
          if (prev.attachmentId === id && prev.preview === null) {
            return { ...prev, preview: url };
          }
          return prev;
        });
      } catch {
        // Falha silenciosa: mantém o estado de "assinatura enviada"
      }
    };

    photos.forEach((p, idx) => {
      if (p.attachmentId && p.preview === null) {
        void loadPhotoPreview(p.attachmentId, idx);
      }
    });

    if (signatureAttachmentId && signature.preview === null) {
      void loadSignaturePreview(signatureAttachmentId);
    }

    return () => {
      // Revoga todas as object URLs criadas para evitar vazamento de memória
      for (const url of objectUrls) {
        URL.revokeObjectURL(url);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoAttachmentKey, signatureAttachmentId]);

  const checkin = useCheckin(activeOrder?.id ?? "");
  const updateExecution = useUpdateExecution(activeOrder?.id ?? "");
  const completeOS = useCompleteOS(activeOrder?.id ?? "");

  // ─── Checklist ──────────────────────────────────────────────────────────────
  const photoCount = photos.filter((p) => p.attachmentId ?? p.preview).length;
  const chipOk = !!chipConfirmed && chipConfirmed.replace(/\D/g, "").length >= 5;
  const hasSignature = !!(signature.attachmentId ?? signature.preview);
  const isCompleted = activeOrder?.status === "COMPLETED";

  const requirements = [
    { key: "checkin",   label: "Check-in",   done: checkedIn },
    { key: "photos",    label: "3 fotos",    done: photoCount >= 3 },
    { key: "signature", label: "Assinatura", done: hasSignature },
    { key: "chip",      label: "ID do chip", done: chipOk },
  ];
  const canFinish =
    requirements.every((r) => r.done) &&
    !isCompleted &&
    activeOrder?.status !== "CANCELLED";

  const doneCount = requirements.filter((r) => r.done).length;
  const progressPct = Math.round((doneCount / requirements.length) * 100);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  async function handleLogout() {
    await removeMobileToken();
    router.replace("/tecnico-mobile/login/");
  }

  async function handleCheckin() {
    if (!activeOrder || checkedIn || checkingIn) return;
    setCheckingIn(true);
    try {
      const geo = await getCurrentLocation();
      const payload = {
        checkinAt: new Date().toISOString(),
        checkinLat: geo?.latitude,
        checkinLng: geo?.longitude,
        checkinLocation: geo
          ? `${geo.latitude.toFixed(6)},${geo.longitude.toFixed(6)}`
          : undefined,
      };
      await checkin.mutateAsync(payload);
      setCheckedIn(true);
      toast.success("Check-in realizado!");
    } catch {
      toast.error("Erro ao fazer check-in. Tente novamente.");
    } finally {
      setCheckingIn(false);
    }
  }

  async function handlePhoto(slotIndex: number) {
    if (!activeOrder) return;
    const slotLabel = ["antes", "durante", "depois"][slotIndex];
    try {
      const result = await capturePhoto(slotLabel);
      // Preview imediato
      setPhotos((prev) => {
        const next = [...prev] as typeof prev;
        next[slotIndex] = { preview: result.dataUrl, attachmentId: null, uploading: true, error: false };
        return next;
      });
      // Upload — retorna attachmentId (sem URL publica)
      const attachmentId = await uploadPhotoBlob(result.blob, result.filename);
      setPhotos((prev) => {
        const next = [...prev] as typeof prev;
        // Mantem o dataUrl local como preview; registra o attachmentId
        next[slotIndex] = {
          preview: result.dataUrl,
          attachmentId,
          uploading: false,
          error: false,
        };
        return next;
      });
      // Persiste os IDs dos anexos no backend
      const ids = [...photos].map((p, i) =>
        i === slotIndex ? attachmentId : (p.attachmentId ?? "")
      );
      await updateExecution.mutateAsync({ photoAttachmentIds: ids.filter(Boolean) });
    } catch (err) {
      if (err instanceof Error && err.message === "Foto cancelada") return;
      setPhotos((prev) => {
        const next = [...prev] as typeof prev;
        next[slotIndex] = { ...next[slotIndex], uploading: false, error: true };
        return next;
      });
      toast.error("Erro ao enviar foto. Toque no slot para tentar novamente.", { duration: 4000 });
    }
  }

  async function handleSignatureConfirm(dataUrl: string) {
    if (!activeOrder) return;
    setSignature({ preview: dataUrl, attachmentId: null, uploading: true });
    try {
      const attachmentId = await uploadSignatureDataUrl(dataUrl, activeOrder.id);
      // Mantem o dataUrl como preview local; registra o attachmentId
      setSignature({ preview: dataUrl, attachmentId, uploading: false });
      await updateExecution.mutateAsync({ signatureAttachmentId: attachmentId });
    } catch {
      setSignature({ preview: dataUrl, attachmentId: null, uploading: false });
      toast.error("Erro ao salvar assinatura.");
    }
  }

  function handleSignatureClear() {
    setSignature({ preview: null, attachmentId: null, uploading: false });
  }

  async function handleChipConfirm() {
    if (!activeOrder || !chipDraft.trim()) return;
    const id = chipDraft.trim();
    try {
      await updateExecution.mutateAsync({ chipIccid: id });
      setChipConfirmed(id);
      toast.success("Chip confirmado!");
    } catch {
      toast.error("Erro ao confirmar chip.");
    }
  }

  async function handleFinalize() {
    if (!activeOrder || !canFinish) return;
    try {
      const geo = await getCurrentLocation();
      await completeOS.mutateAsync({
        checkoutAt: new Date().toISOString(),
        checkoutLat: geo?.latitude,
        checkoutLng: geo?.longitude,
      });
      toast.success("OS finalizada com sucesso!", { duration: 4000 });
      // Limpa estado local
      setPhotos([EMPTY_PHOTO, EMPTY_PHOTO, EMPTY_PHOTO]);
      setSignature({ preview: null, attachmentId: null, uploading: false });
      setChipConfirmed(null);
      setChipDraft("");
      setCheckedIn(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao finalizar OS";
      toast.error(msg);
    }
  }

  async function handlePullRefresh() {
    setIsPulling(true);
    await refetchOrders();
    setIsPulling(false);
  }

  // ─── Sync manual (header) ────────────────────────────────────────────────────
  function handleManualSync() {
    if (!isOnline) {
      toast.error("Sem conexão. Aguardando rede.");
      return;
    }
    setIsSyncing(true);
    syncQueue(mobileApiClient)
      .then(({ synced, failed }) => {
        clearDoneItems();
        setPendingSync(getPendingCount());
        if (synced > 0) toast.success(`${synced} sincronizadas.`);
        if (failed > 0) toast.error(`${failed} falharam.`);
      })
      .finally(() => setIsSyncing(false));
  }

  // ─── Loading skeleton ────────────────────────────────────────────────────────

  if (authed === null || meLoading) {
    return (
      <div
        className="min-h-[100dvh] flex flex-col"
        style={{
          background: "var(--color-surface-0)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        {/* Header skeleton */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: "var(--color-line)" }}
        >
          <Skeleton className="size-9 rounded-[var(--radius-sm)]" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        {/* Stats skeleton */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[68px]" />)}
          </div>
          {[1, 2].map((i) => <Skeleton key={i} className="h-[88px]" />)}
        </div>
      </div>
    );
  }

  if (authed === false) return null;

  // ─── Stats ───────────────────────────────────────────────────────────────────
  const todayOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === "OPEN" || o.status === "IN_PROGRESS").length;
  const completedOrders = orders.filter((o) => o.status === "COMPLETED").length;

  // Avatar inicial do nome
  const techName = me?.name ?? me?.email ?? "Técnico";
  const avatarInitial = techName.charAt(0).toUpperCase();

  // ─── Client address for maps ─────────────────────────────────────────────────
  const clientAddress = activeOrder?.client
    ? [activeOrder.client.address, activeOrder.client.city, activeOrder.client.state]
        .filter(Boolean)
        .join(", ")
    : null;
  const mapsUrl = buildMapsUrl(clientAddress);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-[100dvh]"
      style={{
        background: "var(--color-surface-0)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 border-b backdrop-blur-md px-4 pb-3"
        style={{
          background: "color-mix(in srgb, var(--color-surface-0) 95%, transparent)",
          borderColor: "var(--color-line)",
          paddingTop: "max(12px, calc(env(safe-area-inset-top) + 4px))",
        }}
      >
        {/* Avatar de inicial */}
        <div
          className="size-9 shrink-0 flex items-center justify-center rounded-[var(--radius-sm)] border"
          style={{
            background: "var(--color-teal-soft)",
            borderColor: "var(--color-teal-border)",
          }}
          aria-hidden="true"
        >
          {avatarInitial ? (
            <span className="text-[13px] font-bold" style={{ color: "var(--color-teal)" }}>
              {avatarInitial}
            </span>
          ) : (
            <User className="size-4" style={{ color: "var(--color-teal)" }} />
          )}
        </div>

        {/* Nome e subtítulo */}
        <div className="flex-1 leading-tight min-w-0">
          <span className="block text-[11px] truncate" style={{ color: "var(--color-muted)" }}>
            {techName}
          </span>
          <strong className="block text-sm truncate" style={{ color: "var(--color-ink)" }}>
            Minhas OS
          </strong>
        </div>

        {/* Ícone de rede */}
        {isOnline ? (
          <Wifi className="size-[18px] shrink-0" style={{ color: "var(--color-teal)" }} />
        ) : (
          <WifiOff className="size-[18px] shrink-0" style={{ color: "var(--color-red-bright)" }} />
        )}

        {/* Badge de sync pendente */}
        {pendingSync > 0 && (
          <button
            onClick={handleManualSync}
            className="flex items-center gap-1 rounded-[var(--radius-xs)] border px-2.5 py-1 text-[11px] font-semibold min-h-[32px] min-w-[40px]"
            style={{
              background: "var(--color-amber-soft)",
              borderColor: "var(--color-amber-border)",
              color: "var(--color-amber)",
            }}
            aria-label={`${pendingSync} ações pendentes de sincronização`}
          >
            {isSyncing ? (
              <RefreshCw className="size-3 animate-spin" />
            ) : (
              <Clock className="size-3" />
            )}
            {pendingSync}
          </button>
        )}

        {/* Botão logout */}
        <Button
          variant="icon"
          size="icon"
          className="shrink-0"
          onClick={handleLogout}
          aria-label="Sair"
          title="Sair"
        >
          <LogOut className="size-4" />
        </Button>
      </header>

      {/* ── Banner offline ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            key="offline-banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              className="offline-banner"
              role="status"
              aria-live="polite"
            >
              <WifiOff className="size-4 shrink-0" />
              Sem conexão — ações ficam salvas localmente.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-4 px-4 py-4">

        {/* ── Seção HOJE + Atualizar ──────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <span className="label-eyebrow">Hoje</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePullRefresh}
            disabled={ordersLoading || isPulling}
            className="text-[12px]"
            aria-label="Atualizar lista de OS"
          >
            <RefreshCw
              className={cn("size-3.5", (ordersLoading || isPulling) && "animate-spin")}
            />
            Atualizar
          </Button>
        </div>

        {/* ── Stats grid (3 colunas) ──────────────────────────────────────── */}
        <section aria-label="Resumo do dia" className="grid grid-cols-3 gap-2">
          <StatCard
            label="Total"
            value={todayOrders}
            index={0}
          />
          <StatCard
            label="Pendentes"
            value={pendingOrders}
            warn={pendingOrders > 0}
            index={1}
          />
          <StatCard
            label="Feitas"
            value={completedOrders}
            success={completedOrders > 0 && completedOrders === todayOrders}
            index={2}
          />
        </section>

        {/* ── Lista de OS ─────────────────────────────────────────────────── */}
        <section aria-label="Ordens de serviço" className="flex flex-col gap-2">
          <span className="label-eyebrow">Ordens de serviço</span>

          {ordersLoading ? (
            <>
              <Skeleton className="h-[88px]" />
              <Skeleton className="h-[88px]" />
            </>
          ) : orders.length === 0 ? (
            <EmptyState
              tone="neutral"
              icon={<ClipboardList />}
              title="Nenhuma OS atribuída hoje"
              description="Aguarde a atribuição pelo supervisor"
              action={
                <Button variant="ghost" size="sm" onClick={handlePullRefresh}>
                  Atualizar lista
                </Button>
              }
            />
          ) : (
            orders.map((o, idx) => {
              const cfg = STATUS_CONFIG[o.status];
              const isActive = o.id === (activeOrder?.id ?? "");
              const createdAt = o.openingDate
                ? new Date(o.openingDate).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null;
              const address = o.client
                ? [o.client.address, o.client.city].filter(Boolean).join(", ")
                : null;

              return (
                <motion.button
                  key={o.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => setActiveOrderId(o.id)}
                  className={cn(
                    "w-full text-left p-4 transition-all duration-[200ms]",
                    "rounded-[var(--radius-md)] border",
                    "active:scale-[0.99]",
                    isActive
                      ? "border-l-2 border-l-[var(--color-amber)] border-[var(--color-amber-border)]"
                      : "border-[var(--color-line)]"
                  )}
                  style={{
                    background: isActive
                      ? "var(--color-amber-soft)"
                      : "var(--color-surface-2)",
                  }}
                  aria-pressed={isActive}
                  aria-label={`OS #${o.number} — ${o.client.name}`}
                >
                  {/* Linha topo: badge status + número + prioridade */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={cfg.tone} size="sm">
                      {cfg.icon}
                      {cfg.text}
                    </Badge>
                    <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                      #{o.number}
                    </span>
                    {o.priority !== "NORMAL" && (
                      <Badge tone={PRIORITY_BADGE[o.priority].tone} size="sm">
                        {PRIORITY_BADGE[o.priority].label}
                      </Badge>
                    )}
                    {o.priority === "NORMAL" && (
                      <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                        · {PRIORITY_LABEL[o.priority]}
                      </span>
                    )}
                  </div>

                  {/* Nome do cliente */}
                  <strong
                    className="mt-1.5 block text-[15px] font-bold"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {o.client.name}
                  </strong>

                  {/* Descrição */}
                  {o.description && (
                    <p
                      className="mt-0.5 line-clamp-1 text-[13px]"
                      style={{ color: "var(--color-muted)" }}
                    >
                      {o.description}
                    </p>
                  )}

                  {/* Metadados: hora + endereço */}
                  {(createdAt || address) && (
                    <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                      {createdAt && (
                        <span
                          className="flex items-center gap-1 text-[11px]"
                          style={{ color: "var(--color-muted)" }}
                        >
                          <Clock className="size-3" />
                          {createdAt}
                        </span>
                      )}
                      {address && (
                        <span
                          className="flex items-center gap-1 text-[11px] line-clamp-1 min-w-0"
                          style={{ color: "var(--color-muted)" }}
                        >
                          <MapPin className="size-3 shrink-0" />
                          <span className="line-clamp-1">{address}</span>
                        </span>
                      )}
                    </div>
                  )}
                </motion.button>
              );
            })
          )}
        </section>

        {/* ── Painel de execução da OS ativa ─────────────────────────────── */}
        <AnimatePresence mode="wait">
          {activeOrder && !isCompleted && activeOrder.status !== "CANCELLED" && (
            <motion.div
              key={activeOrder.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-3"
            >
              {/* ── Card cliente ─────────────────────────────────────────── */}
              <Card
                variant="elevated"
                tone={checkedIn ? "teal" : "default"}
              >
                {/* Status badge + número */}
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge tone={STATUS_CONFIG[activeOrder.status].tone} size="md">
                    {STATUS_CONFIG[activeOrder.status].icon}
                    {STATUS_CONFIG[activeOrder.status].text}
                  </Badge>
                  <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                    OS #{activeOrder.number}
                  </span>
                </div>

                {/* Nome do cliente */}
                <h2
                  className="font-bold leading-snug"
                  style={{ fontSize: "17px", color: "var(--color-ink)" }}
                >
                  {activeOrder.client.name}
                </h2>

                {/* Descrição */}
                {activeOrder.description && (
                  <p
                    className="mt-1 text-[13px] line-clamp-2"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {activeOrder.description}
                  </p>
                )}

                {/* Endereço */}
                {clientAddress && (
                  <p className="mt-1 text-[11px]" style={{ color: "var(--color-muted)" }}>
                    {clientAddress}
                  </p>
                )}

                {/* Botões rápidos: Ligar + Rota */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {activeOrder.client.phone && (
                    <Button variant="secondary" size="default" asChild>
                      <a href={`tel:${activeOrder.client.phone}`}>
                        <Phone className="size-4" /> Ligar
                      </a>
                    </Button>
                  )}
                  <Button variant="secondary" size="default" asChild>
                    <a href={mapsUrl} target="_blank" rel="noreferrer">
                      <MapPin className="size-4" /> Rota
                    </a>
                  </Button>
                </div>

                {/* Botão check-in */}
                {checkedIn ? (
                  <Button
                    variant="outline"
                    size="xl"
                    className="w-full mt-3"
                    disabled
                    aria-disabled="true"
                  >
                    <CheckCircle2 className="size-5" style={{ color: "var(--color-teal)" }} />
                    Check-in realizado
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="xl"
                    className="w-full mt-3"
                    isLoading={checkingIn}
                    disabled={checkingIn}
                    onClick={handleCheckin}
                  >
                    {checkingIn ? (
                      <>
                        <RefreshCw className="size-4 animate-spin" />
                        Aguardando GPS...
                      </>
                    ) : (
                      "Iniciar atendimento"
                    )}
                  </Button>
                )}
              </Card>

              {/* ── Card checklist + execução ─────────────────────────── */}
              <Card variant="default">
                {/* Cabeçalho com badge de status geral */}
                <div className="flex items-center justify-between mb-3">
                  <strong className="text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>
                    Conclusão da OS
                  </strong>
                  <Badge tone={canFinish ? "teal" : "amber"} size="md">
                    {canFinish ? "Liberado" : "Pendente"}
                  </Badge>
                </div>

                {/* Progress bar */}
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                    Progresso: {doneCount} de {requirements.length} etapas
                  </span>
                </div>
                <div
                  className="h-1.5 w-full rounded-full mb-4"
                  style={{ background: "var(--color-line)" }}
                  role="progressbar"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progresso da OS"
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progressPct}%`,
                      background: "var(--color-teal)",
                    }}
                  />
                </div>

                {/* Grid 2×2 checklist */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {requirements.map((r) => (
                    <div
                      key={r.key}
                      className={cn(
                        "flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 min-h-[52px]",
                        "text-[12px] font-medium transition-all duration-200"
                      )}
                      style={
                        r.done
                          ? {
                              background: "var(--color-teal-soft)",
                              borderColor: "var(--color-teal-border)",
                              color: "var(--color-teal)",
                            }
                          : {
                              background: "var(--color-surface-2)",
                              borderColor: "var(--color-line)",
                              color: "var(--color-muted)",
                            }
                      }
                    >
                      {r.done ? (
                        <CheckCircle2 className="size-4 shrink-0" />
                      ) : (
                        <Circle
                          className="size-4 shrink-0"
                          style={{ color: "var(--color-disabled)" }}
                        />
                      )}
                      {r.label}
                    </div>
                  ))}
                </div>

                {/* ── Seção fotos ───────────────────────────────────────── */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: "var(--color-ink)" }}
                    >
                      Registro fotográfico
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                      {photoCount}/3
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(["Antes", "Durante", "Depois"] as const).map((label, idx) => {
                      const p = photos[idx];
                      const uploaded = !!(p.attachmentId && !p.uploading);

                      return (
                        <button
                          key={label}
                          onClick={() => handlePhoto(idx)}
                          disabled={p.uploading}
                          aria-label={`Foto ${label}${uploaded ? " — enviada" : p.error ? " — erro, toque para tentar novamente" : " — pendente"}`}
                          className={cn(
                            "relative aspect-square overflow-hidden rounded-[var(--radius-md)]",
                            "border-2 border-dashed transition-all duration-200",
                            "active:scale-[0.97] disabled:opacity-60"
                          )}
                          style={
                            uploaded
                              ? { borderColor: "var(--color-teal-border)", borderStyle: "solid" }
                              : p.error
                              ? { borderColor: "var(--color-red-border)", borderStyle: "dashed" }
                              : {
                                  borderColor: "var(--color-line-strong)",
                                  background: "var(--color-surface-2)",
                                }
                          }
                        >
                          {/* Preview da foto */}
                          {p.preview && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.preview}
                              alt={label}
                              className="absolute inset-0 size-full object-cover"
                            />
                          )}

                          {/* Ícone câmera quando vazio */}
                          {!p.preview && !p.error && (
                            <Camera
                              className="absolute inset-0 m-auto size-6"
                              style={{ color: "var(--color-disabled)" }}
                            />
                          )}

                          {/* Overlay uploading */}
                          {p.uploading && (
                            <div
                              className="absolute inset-0 flex items-center justify-center"
                              style={{ background: "rgba(13,13,16,0.70)" }}
                            >
                              <RefreshCw className="size-5 animate-spin text-white" />
                            </div>
                          )}

                          {/* Overlay erro */}
                          {p.error && !p.uploading && (
                            <div
                              className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1"
                              style={{ background: "var(--color-red-soft)" }}
                            >
                              <AlertCircle
                                className="size-4"
                                style={{ color: "var(--color-red-bright)" }}
                              />
                              <span
                                className="text-center text-[9px] font-medium leading-tight"
                                style={{ color: "var(--color-red-bright)" }}
                              >
                                Toque para tentar novamente
                              </span>
                            </div>
                          )}

                          {/* Badge enviado */}
                          {uploaded && (
                            <div className="absolute top-1 right-1">
                              <CheckCircle2
                                className="size-4 drop-shadow"
                                style={{ color: "var(--color-teal)" }}
                              />
                            </div>
                          )}

                          {/* Label do slot */}
                          <span className="absolute bottom-1.5 left-0 right-0 text-center text-[10px] font-bold text-white drop-shadow">
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Seção assinatura ─────────────────────────────────── */}
                <div className="mb-4">
                  <p
                    className="mb-2 text-[13px] font-semibold"
                    style={{ color: "var(--color-ink)" }}
                  >
                    Assinatura do cliente
                  </p>
                  {signature.uploading && (
                    <div
                      className="mb-2 flex items-center gap-1.5 text-[12px]"
                      style={{ color: "var(--color-amber)" }}
                    >
                      <RefreshCw className="size-3 animate-spin" />
                      Salvando assinatura...
                    </div>
                  )}
                  <SignaturePad
                    value={signature.preview ?? null}
                    onConfirm={handleSignatureConfirm}
                    onClear={handleSignatureClear}
                  />
                </div>

                {/* ── Seção chip ICCID ─────────────────────────────────── */}
                <div className="mb-4">
                  <Card variant="subtle">
                    <Label className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
                      ID do Chip (ICCID)
                    </Label>
                    <Input
                      value={chipDraft}
                      onChange={(e) => setChipDraft(e.target.value)}
                      placeholder="89 5504 1234 5678 9012"
                      className="mt-2"
                      inputMode="numeric"
                      error={chipDraft.length > 0 && chipDraft.replace(/\D/g, "").length < 5}
                      aria-label="ID do chip ICCID"
                    />
                    <Button
                      variant="outline"
                      size="default"
                      className="w-full mt-2"
                      onClick={handleChipConfirm}
                      disabled={!chipDraft.trim() || updateExecution.isPending}
                      aria-disabled={!chipDraft.trim() || updateExecution.isPending}
                    >
                      <BadgeCheck className="size-4" />
                      Confirmar chip
                    </Button>
                    {chipOk && (
                      <p
                        className="mt-2 flex items-center gap-1.5 text-[12px]"
                        style={{ color: "var(--color-teal)" }}
                      >
                        <CheckCircle2 className="size-3.5 shrink-0" />
                        Chip confirmado: {chipConfirmed}
                      </p>
                    )}
                  </Card>
                </div>

                {/* ── Botão Finalizar OS ───────────────────────────────── */}
                <Button
                  variant="primary"
                  size="xl"
                  className="w-full"
                  disabled={!canFinish || completeOS.isPending}
                  aria-disabled={!canFinish || completeOS.isPending}
                  isLoading={completeOS.isPending}
                  onClick={handleFinalize}
                >
                  {completeOS.isPending ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Finalizando...
                    </>
                  ) : (
                    "Finalizar OS"
                  )}
                </Button>

                {/* Hint quando desabilitado */}
                {!canFinish && (
                  <p
                    className="mt-2 text-center text-[11px]"
                    style={{ color: "var(--color-muted)" }}
                    aria-live="polite"
                  >
                    Complete todas as etapas para finalizar
                  </p>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Estado OS Concluída ─────────────────────────────────────────── */}
        <AnimatePresence>
          {activeOrder?.status === "COMPLETED" && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <Card tone="teal" variant="elevated" className="text-center p-8">
                <CheckCircle2
                  className="mx-auto mb-3 size-14"
                  style={{ color: "var(--color-teal)" }}
                />
                <strong
                  className="block text-[17px] font-bold"
                  style={{ color: "var(--color-ink)" }}
                >
                  OS #{activeOrder.number} Concluída!
                </strong>
                <p
                  className="mt-1 text-[13px]"
                  style={{ color: "var(--color-muted)" }}
                >
                  {activeOrder.client.name} — atendimento encerrado
                </p>
                <Button
                  variant="secondary"
                  size="default"
                  className="mt-5"
                  onClick={() => setActiveOrderId(null)}
                >
                  Ver outras OS
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
