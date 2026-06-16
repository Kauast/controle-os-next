import { openDB, type IDBPDatabase } from "idb";

export interface QueueAction {
  id: string;
  serviceOrderId: string;
  type: "CHECKIN" | "UPDATE_EXECUTION" | "UPDATE_STATUS" | "COMPLETE_OS";
  payload: Record<string, unknown>;
  expectedVersion?: number;
  status: "pending" | "syncing" | "done" | "error" | "conflict";
  retryCount: number;
  nextAttemptAt: number;
  createdAt: string;
  error?: string;
}

const DB_NAME = "controle_os_offline";
const STORE = "queue";
let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function putAction(a: QueueAction): Promise<void> {
  await (await db()).put(STORE, a);
}
export async function allActions(): Promise<QueueAction[]> {
  return (await db()).getAll(STORE);
}
export async function deleteAction(id: string): Promise<void> {
  await (await db()).delete(STORE, id);
}
export async function clearAll(): Promise<void> {
  await (await db()).clear(STORE);
}
