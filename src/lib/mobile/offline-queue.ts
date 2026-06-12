export type QueueActionType =
  | "CHECKIN"
  | "UPDATE_EXECUTION"
  | "UPDATE_STATUS"
  | "COMPLETE_OS";

export interface QueueAction {
  id: string;
  serviceOrderId: string;
  type: QueueActionType;
  payload: Record<string, unknown>;
  status: "pending" | "syncing" | "done" | "error";
  retryCount: number;
  createdAt: string;
  error?: string;
}

const QUEUE_KEY = "offline_queue_v1";
const MAX_RETRIES = 3;

function loadQueue(): QueueAction[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: QueueAction[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

export function enqueue(
  action: Omit<QueueAction, "id" | "status" | "retryCount" | "createdAt">
): void {
  const queue = loadQueue();
  queue.push({
    ...action,
    id: crypto.randomUUID(),
    status: "pending",
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });
  saveQueue(queue);
}

export function getQueue(): QueueAction[] {
  return loadQueue();
}

export function getPendingCount(): number {
  return loadQueue().filter(
    (a) => a.status === "pending" || a.status === "syncing"
  ).length;
}

export function clearDoneItems(): void {
  saveQueue(loadQueue().filter((a) => a.status !== "done"));
}

async function executeAction(
  action: QueueAction,
  client: { patch: (url: string, data: unknown) => Promise<unknown> }
): Promise<void> {
  const { serviceOrderId, type, payload } = action;
  switch (type) {
    case "CHECKIN":
    case "UPDATE_EXECUTION":
      await client.patch(`/service-orders/${serviceOrderId}/execution`, payload);
      break;
    case "UPDATE_STATUS":
    case "COMPLETE_OS":
      await client.patch(`/service-orders/${serviceOrderId}/status`, payload);
      break;
  }
}

export async function syncQueue(
  client: { patch: (url: string, data: unknown) => Promise<unknown> },
  onProgress?: (done: number, total: number) => void
): Promise<{ synced: number; failed: number }> {
  const queue = loadQueue();
  const pending = queue.filter(
    (a) => a.status === "pending" || (a.status === "error" && a.retryCount < MAX_RETRIES)
  );

  let synced = 0;
  let failed = 0;

  for (const action of pending) {
    const idx = queue.findIndex((a) => a.id === action.id);
    if (idx === -1) continue;
    queue[idx].status = "syncing";
    saveQueue(queue);

    try {
      await executeAction(action, client);
      queue[idx].status = "done";
      synced++;
    } catch (err) {
      queue[idx].retryCount++;
      queue[idx].status =
        queue[idx].retryCount >= MAX_RETRIES ? "error" : "pending";
      queue[idx].error =
        err instanceof Error ? err.message : "Erro desconhecido";
      failed++;
    }

    saveQueue(queue);
    onProgress?.(synced + failed, pending.length);
  }

  return { synced, failed };
}
