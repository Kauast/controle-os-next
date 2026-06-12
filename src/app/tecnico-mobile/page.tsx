"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock,
  LogOut,
  MapPin,
  Phone,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  preview: string | null;
  url: string | null;
  uploading: boolean;
  error: boolean;
}

const EMPTY_PHOTO: PhotoSlotState = { preview: null, url: null, uploading: false, error: false };

const STATUS_LABEL: Record<MobileServiceOrder["status"], { text: string; cls: string }> = {
  OPEN: { text: "Aberta", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  IN_PROGRESS: { text: "Em andamento", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  WAITING_PARTS: { text: "Aguardando peças", cls: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  COMPLETED: { text: "Concluída", cls: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
  CANCELLED: { text: "Cancelada", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
};

const PRIORITY_LABEL: Record<MobileServiceOrder["priority"], string> = {
  NORMAL: "Normal",
  WARNING: "Atenção",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-white/8", className)} />;
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
    url: string | null;
    uploading: boolean;
  }>({ preview: null, url: null, uploading: false });
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
    // Reconstrói fotos a partir das URLs salvas
    if (exec?.photoUrls?.length) {
      setPhotos((prev) =>
        prev.map((p, i) => {
          const savedUrl = exec.photoUrls![i];
          return savedUrl ? { ...EMPTY_PHOTO, url: savedUrl, preview: savedUrl } : p;
        }) as [PhotoSlotState, PhotoSlotState, PhotoSlotState]
      );
    } else {
      setPhotos([EMPTY_PHOTO, EMPTY_PHOTO, EMPTY_PHOTO]);
    }
    if (exec?.clientSignature) {
      setSignature({ preview: exec.clientSignature, url: exec.clientSignature, uploading: false });
    } else {
      setSignature({ preview: null, url: null, uploading: false });
    }
  }, [activeOrder?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkin = useCheckin(activeOrder?.id ?? "");
  const updateExecution = useUpdateExecution(activeOrder?.id ?? "");
  const completeOS = useCompleteOS(activeOrder?.id ?? "");

  // ─── Checklist ──────────────────────────────────────────────────────────────
  const photoCount = photos.filter((p) => p.url || p.preview).length;
  const chipOk = !!chipConfirmed && chipConfirmed.replace(/\D/g, "").length >= 5;
  const hasSignature = !!signature.url || !!signature.preview;
  const isCompleted = activeOrder?.status === "COMPLETED";

  const requirements = [
    { key: "checkin", label: "Check-in", done: checkedIn },
    { key: "photos", label: "3 fotos", done: photoCount >= 3 },
    { key: "signature", label: "Assinatura", done: hasSignature },
    { key: "chip", label: "ID do chip", done: chipOk },
  ];
  const canFinish =
    requirements.every((r) => r.done) &&
    !isCompleted &&
    activeOrder?.status !== "CANCELLED";

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
        next[slotIndex] = { preview: result.dataUrl, url: null, uploading: true, error: false };
        return next;
      });
      // Upload
      const url = await uploadPhotoBlob(result.blob, result.filename);
      setPhotos((prev) => {
        const next = [...prev] as typeof prev;
        next[slotIndex] = { preview: url, url, uploading: false, error: false };
        return next;
      });
      // Salva URLs no backend
      const urls = [...photos].map((p, i) =>
        i === slotIndex ? url : p.url ?? p.preview ?? ""
      );
      await updateExecution.mutateAsync({ photoUrls: urls.filter(Boolean) });
    } catch (err) {
      if (err instanceof Error && err.message === "Foto cancelada") return;
      setPhotos((prev) => {
        const next = [...prev] as typeof prev;
        next[slotIndex] = { ...next[slotIndex], uploading: false, error: true };
        return next;
      });
      toast.error("Erro ao enviar foto. Toque para tentar novamente.");
    }
  }

  async function handleSignatureConfirm(dataUrl: string) {
    if (!activeOrder) return;
    setSignature({ preview: dataUrl, url: null, uploading: true });
    try {
      const url = await uploadSignatureDataUrl(dataUrl, activeOrder.id);
      setSignature({ preview: url, url, uploading: false });
      await updateExecution.mutateAsync({ clientSignature: url });
    } catch {
      setSignature({ preview: dataUrl, url: null, uploading: false });
      toast.error("Erro ao salvar assinatura.");
    }
  }

  function handleSignatureClear() {
    setSignature({ preview: null, url: null, uploading: false });
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
      toast.success("OS finalizada com sucesso!");
      // Limpa estado local
      setPhotos([EMPTY_PHOTO, EMPTY_PHOTO, EMPTY_PHOTO]);
      setSignature({ preview: null, url: null, uploading: false });
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

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (authed === null || meLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#0d0d0d] flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Skeleton className="size-9 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (authed === false) return null;

  // ─── Stats ───────────────────────────────────────────────────────────────────
  const todayOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === "OPEN" || o.status === "IN_PROGRESS").length;
  const completedOrders = orders.filter((o) => o.status === "COMPLETED").length;

  // ─── Client address for maps ─────────────────────────────────────────────────
  const clientAddress = activeOrder?.client
    ? [activeOrder.client.address, activeOrder.client.city, activeOrder.client.state]
        .filter(Boolean)
        .join(", ")
    : null;
  const mapsUrl = buildMapsUrl(clientAddress);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[100dvh] bg-[#0d0d0d]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-[#0d0d0d]/95 px-4 py-3 backdrop-blur-md" style={{ paddingTop: "max(12px, calc(env(safe-area-inset-top) + 4px))" }}>
        <div className="flex-1 leading-tight min-w-0">
          <span className="block text-[11px] text-white/40">
            {me?.name ?? me?.email ?? "Técnico"}
          </span>
          <strong className="block text-sm text-white truncate">Minhas OS</strong>
        </div>

        {/* Status de rede */}
        {isOnline ? (
          <Wifi className="size-4 text-teal-400 shrink-0" />
        ) : (
          <WifiOff className="size-4 text-red-400 shrink-0" />
        )}

        {/* Contador de sync pendente */}
        {pendingSync > 0 && (
          <button
            onClick={() => {
              if (!isOnline) { toast.error("Sem conexão. Aguardando rede."); return; }
              setIsSyncing(true);
              syncQueue(mobileApiClient)
                .then(({ synced, failed }) => {
                  clearDoneItems();
                  setPendingSync(getPendingCount());
                  if (synced > 0) toast.success(`${synced} sincronizadas.`);
                  if (failed > 0) toast.error(`${failed} falharam.`);
                })
                .finally(() => setIsSyncing(false));
            }}
            className="relative flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-400"
          >
            {isSyncing ? (
              <RefreshCw className="size-3 animate-spin" />
            ) : (
              <Clock className="size-3" />
            )}
            {pendingSync}
          </button>
        )}

        <Button
          variant="secondary"
          size="icon"
          className="size-9 shrink-0"
          onClick={handleLogout}
          title="Sair"
        >
          <LogOut className="size-4" />
        </Button>
      </header>

      {/* Offline banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-xs text-red-400">
              <WifiOff className="size-3.5 shrink-0" />
              Sem conexão — ações ficam salvas e sincronizam automaticamente.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Pull to refresh */}
        <button
          onClick={handlePullRefresh}
          disabled={ordersLoading || isPulling}
          className="mx-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50 active:bg-white/10 disabled:opacity-40"
        >
          <RefreshCw className={cn("size-3", (ordersLoading || isPulling) && "animate-spin")} />
          Atualizar
        </button>

        {/* Stats grid */}
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "OS hoje", value: todayOrders },
            { label: "Pendentes", value: pendingOrders },
            { label: "Concluídas", value: completedOrders },
            { label: "Status", value: isOnline ? "Online" : "Offline" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-white/10 bg-white/5 p-3 text-center"
            >
              <strong className="block text-lg text-white">{s.value}</strong>
              <span className="text-[10px] text-white/40">{s.label}</span>
            </div>
          ))}
        </section>

        {/* OS List */}
        <section className="flex flex-col gap-2">
          <strong className="text-sm text-white/80">Ordens de serviço</strong>

          {ordersLoading ? (
            [1, 2].map((i) => <Skeleton key={i} className="h-20" />)
          ) : orders.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 py-8 text-center text-sm text-white/40">
              Nenhuma OS atribuída a você.
            </div>
          ) : (
            orders.map((o) => {
              const sl = STATUS_LABEL[o.status];
              const isActive = o.id === (activeOrder?.id ?? "");
              return (
                <button
                  key={o.id}
                  onClick={() => setActiveOrderId(o.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-all active:scale-[0.99]",
                    isActive
                      ? "border-amber-500/40 bg-amber-500/10"
                      : "border-white/10 bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                        sl.cls
                      )}
                    >
                      {sl.text}
                    </span>
                    <span className="text-[10px] text-white/40">
                      #{o.number} · {PRIORITY_LABEL[o.priority]}
                    </span>
                  </div>
                  <strong className="mt-1 block text-sm text-white">{o.client.name}</strong>
                  {o.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-white/50">{o.description}</p>
                  )}
                </button>
              );
            })
          )}
        </section>

        {/* Active OS execution panel */}
        <AnimatePresence mode="wait">
          {activeOrder && !isCompleted && activeOrder.status !== "CANCELLED" && (
            <motion.div
              key={activeOrder.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-3"
            >
              {/* Client info card */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                      STATUS_LABEL[activeOrder.status].cls
                    )}
                  >
                    {STATUS_LABEL[activeOrder.status].text}
                  </span>
                  <span className="text-[10px] text-white/40">
                    OS #{activeOrder.number}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white">{activeOrder.client.name}</h2>
                {activeOrder.description && (
                  <p className="mt-0.5 text-sm text-white/60">{activeOrder.description}</p>
                )}
                {clientAddress && (
                  <p className="mt-1 text-xs text-white/40">{clientAddress}</p>
                )}

                <div className="mt-3 flex gap-2">
                  {activeOrder.client.phone && (
                    <Button variant="secondary" size="sm" className="flex-1 min-h-[44px]" asChild>
                      <a href={`tel:${activeOrder.client.phone}`}>
                        <Phone className="size-4" /> Ligar
                      </a>
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" className="flex-1 min-h-[44px]" asChild>
                    <a href={mapsUrl} target="_blank" rel="noreferrer">
                      <MapPin className="size-4" /> Rota
                    </a>
                  </Button>
                </div>

                <Button
                  className="mt-3 w-full min-h-[48px]"
                  disabled={checkedIn || checkingIn}
                  onClick={handleCheckin}
                >
                  {checkingIn
                    ? "Aguardando GPS..."
                    : checkedIn
                    ? "✓ Check-in realizado"
                    : "Iniciar atendimento"}
                </Button>
              </div>

              {/* Checklist + execução */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <strong className="text-sm text-white/80">Conclusão da OS</strong>
                  <span
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                      canFinish
                        ? "border-teal-500/30 bg-teal-500/15 text-teal-400"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    )}
                  >
                    {canFinish ? "Liberado" : "Pendente"}
                  </span>
                </div>

                {/* Checklist items */}
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {requirements.map((r) => (
                    <div
                      key={r.key}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium",
                        r.done
                          ? "border-teal-500/30 bg-teal-500/10 text-teal-400"
                          : "border-white/10 bg-white/5 text-white/40"
                      )}
                    >
                      <CheckCircle2 className="size-3.5 shrink-0" />
                      {r.label}
                    </div>
                  ))}
                </div>

                {/* Photos */}
                <div className="mb-4">
                  <p className="mb-2 text-xs text-white/50">Fotos ({photoCount}/3)</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Antes", "Durante", "Depois"] as const).map((label, idx) => {
                      const p = photos[idx];
                      return (
                        <button
                          key={label}
                          onClick={() => handlePhoto(idx)}
                          disabled={p.uploading}
                          className="relative aspect-square overflow-hidden rounded-xl border border-dashed border-white/20 bg-white/5 active:scale-95 transition-transform disabled:opacity-60"
                        >
                          {p.preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.preview}
                              alt={label}
                              className="absolute inset-0 size-full object-cover"
                            />
                          ) : (
                            <Camera className="m-auto size-5 text-white/30" />
                          )}
                          {p.uploading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                              <RefreshCw className="size-4 animate-spin text-white" />
                            </div>
                          )}
                          {p.error && (
                            <div className="absolute inset-0 flex items-center justify-center bg-red-900/60">
                              <span className="text-[9px] text-red-300">Erro</span>
                            </div>
                          )}
                          {p.url && !p.uploading && (
                            <div className="absolute top-1 right-1">
                              <CheckCircle2 className="size-3.5 text-teal-400 drop-shadow" />
                            </div>
                          )}
                          <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-semibold text-white/80 drop-shadow">
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Signature */}
                <div className="mb-4">
                  <p className="mb-2 text-xs text-white/50">Assinatura do cliente</p>
                  {signature.uploading && (
                    <div className="mb-2 flex items-center gap-1.5 text-xs text-amber-400">
                      <RefreshCw className="size-3 animate-spin" /> Salvando assinatura...
                    </div>
                  )}
                  <SignaturePad
                    value={signature.preview ?? null}
                    onConfirm={handleSignatureConfirm}
                    onClear={handleSignatureClear}
                  />
                </div>

                {/* Chip ID */}
                <div className="mb-4 rounded-xl border border-white/10 bg-[#0d0d0d] p-3">
                  <Label className="text-xs text-white/60">
                    ID do Chip (ICCID)
                    <Input
                      value={chipDraft}
                      onChange={(e) => setChipDraft(e.target.value)}
                      placeholder="89550400 1234 5678 9012"
                      className="mt-1 bg-white/5 border-white/15 text-white min-h-[44px]"
                      inputMode="numeric"
                    />
                  </Label>
                  <Button
                    variant="secondary"
                    className="mt-2 w-full min-h-[44px]"
                    onClick={handleChipConfirm}
                    disabled={!chipDraft.trim() || updateExecution.isPending}
                  >
                    <BadgeCheck className="size-4" /> Confirmar chip
                  </Button>
                  {chipOk && (
                    <p className="mt-1.5 text-xs text-teal-400">✓ Chip confirmado: {chipConfirmed}</p>
                  )}
                </div>

                {/* Finalize */}
                <Button
                  className="w-full min-h-[52px] text-base font-semibold"
                  disabled={!canFinish || completeOS.isPending}
                  onClick={handleFinalize}
                >
                  {completeOS.isPending ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" /> Finalizando...
                    </>
                  ) : (
                    "Finalizar OS"
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* OS Concluída */}
        <AnimatePresence>
          {activeOrder?.status === "COMPLETED" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-6 text-center"
            >
              <CheckCircle2 className="mx-auto mb-2 size-10 text-teal-400" />
              <strong className="block text-base text-white">OS Concluída!</strong>
              <p className="mt-1 text-sm text-white/60">OS #{activeOrder.number} foi finalizada.</p>
              <Button
                variant="secondary"
                className="mt-4 min-h-[44px]"
                onClick={() => setActiveOrderId(null)}
              >
                Ver outras OS
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
