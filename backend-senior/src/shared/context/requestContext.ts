import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextState {
  requestId?: string;
  tenantId?: string;
  tenantSlug?: string;
  userId?: string;
  userEmail?: string;
  role?: string;
  permissions?: string[];
  ip?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContextState>();

export const RequestContext = {
  run<T>(state: RequestContextState, callback: () => T): T {
    return storage.run(state, callback);
  },

  get(): RequestContextState {
    return storage.getStore() ?? {};
  },

  set(patch: Partial<RequestContextState>) {
    const store = storage.getStore();
    if (!store) return;
    Object.assign(store, patch);
  },
};

