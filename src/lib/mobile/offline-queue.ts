import { putAction, allActions, deleteAction, type QueueAction } from "./offline-db";

export type QueueActionType = QueueAction["type"];
export type { QueueAction };

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

function backoff(retry: number): number {
  const exp = BASE_DELAY_MS * 2 ** retry;
  const jitter = Math.random() * 0.3 * exp;
  return Math.min(exp + jitter, 60_000);
}

export async function enqueue(action: {
  serviceOrderId: string;
  type: QueueActionType;
  payload: Record<string, unknown>;
  expectedVersion?: number;
}): Promise<void> {
  await putAction({
    ...action,
    id: crypto.randomUUID(),
    status: "pending",
    retryCount: 0,
    nextAttemptAt: Date.now(),
    createdAt: new Date().toISOString(),
  });
}

export async function getQueue(): Promise<QueueAction[]> {
  return allActions();
}

export async function getPendingCount(): Promise<number> {
  return (await allActions()).filter((a) => a.status === "pending" || a.status === "syncing").length;
}

export async function clearDoneItems(): Promise<void> {
  const done = (await allActions()).filter((a) => a.status === "done");
  await Promise.all(done.map((a) => deleteAction(a.id)));
}

interface HttpClient {
  patch: (url: string, data: unknown, opts?: { headers?: Record<string, string> }) => Promise<unknown>;
}

async function executeAction(action: QueueAction, client: HttpClient): Promise<void> {
  const { serviceOrderId, type, payload, expectedVersion, id } = action;
  const body = expectedVersion !== undefined ? { ...payload, expectedVersion } : payload;
  const headers = { "Idempotency-Key": id };
  const url =
    type === "UPDATE_STATUS" || type === "COMPLETE_OS"
      ? `/service-orders/${serviceOrderId}/status`
      : `/service-orders/${serviceOrderId}/execution`;
  await client.patch(url, body, { headers });
}

export async function syncQueue(
  client: HttpClient,
  onProgress?: (done: number, total: number) => void,
): Promise<{ synced: number; failed: number; conflicts: number }> {
  const now = Date.now();
  const queue = await allActions();
  const pending = queue.filter(
    (a) =>
      (a.status === "pending" || (a.status === "error" && a.retryCount < MAX_RETRIES)) &&
      a.nextAttemptAt <= now,
  );

  let synced = 0,
    failed = 0,
    conflicts = 0;

  for (const action of pending) {
    action.status = "syncing";
    await putAction(action);
    try {
      await executeAction(action, client);
      action.status = "done";
      synced++;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        action.status = "conflict";
        action.error = "Conflito de versão — recarregue a OS";
        conflicts++;
      } else {
        action.retryCount++;
        action.status = action.retryCount >= MAX_RETRIES ? "error" : "pending";
        action.nextAttemptAt = now + backoff(action.retryCount);
        action.error = err instanceof Error ? err.message : "Erro desconhecido";
        failed++;
      }
    }
    await putAction(action);
    onProgress?.(synced + failed + conflicts, pending.length);
  }

  return { synced, failed, conflicts };
}
