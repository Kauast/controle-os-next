import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { enqueue, getQueue, syncQueue, getPendingCount } from "./offline-queue";
import { clearAll } from "./offline-db";

beforeEach(async () => {
  await clearAll();
});

describe("offline-queue (IndexedDB)", () => {
  it("enfileira e persiste ações", async () => {
    await enqueue({ serviceOrderId: "os1", type: "UPDATE_STATUS", payload: { status: "IN_PROGRESS" }, expectedVersion: 1 });
    expect(await getPendingCount()).toBe(1);
  });

  it("envia Idempotency-Key e expectedVersion, marca done em sucesso", async () => {
    await enqueue({ serviceOrderId: "os1", type: "UPDATE_STATUS", payload: { status: "IN_PROGRESS" }, expectedVersion: 2 });
    const seen: { url: string; data: unknown; headers: Record<string, string> }[] = [];
    const client = {
      patch: async (url: string, data: unknown, opts?: { headers?: Record<string, string> }) => {
        seen.push({ url, data, headers: opts?.headers ?? {} });
        return { ok: true };
      },
    };
    const r = await syncQueue(client);
    expect(r.synced).toBe(1);
    expect(seen[0].headers["Idempotency-Key"]).toBeTruthy();
    expect(seen[0].data).toMatchObject({ status: "IN_PROGRESS", expectedVersion: 2 });
    expect((await getQueue()).every((a) => a.status === "done")).toBe(true);
  });

  it("marca conflict em 409 e não reenvia automaticamente", async () => {
    await enqueue({ serviceOrderId: "os1", type: "UPDATE_STATUS", payload: { status: "IN_PROGRESS" }, expectedVersion: 1 });
    const client = {
      patch: async () => {
        const e = new Error("conflito") as Error & { status?: number };
        e.status = 409;
        throw e;
      },
    };
    const r = await syncQueue(client);
    expect(r.conflicts).toBe(1);
    expect((await getQueue())[0].status).toBe("conflict");
    // segunda sync não deve reenviar (continua conflict)
    const r2 = await syncQueue(client);
    expect(r2.conflicts).toBe(0);
    expect((await getQueue())[0].status).toBe("conflict");
  });
});
