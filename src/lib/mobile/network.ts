import { Capacitor } from "@capacitor/core";

export type NetworkStatus = "online" | "offline" | "unknown";

export async function getNetworkStatus(): Promise<NetworkStatus> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Network } = await import("@capacitor/network");
      const status = await Network.getStatus();
      return status.connected ? "online" : "offline";
    } catch {
      return "unknown";
    }
  }
  if (typeof navigator !== "undefined") return navigator.onLine ? "online" : "offline";
  return "unknown";
}

export function listenNetworkChanges(cb: (status: NetworkStatus) => void): () => void {
  if (Capacitor.isNativePlatform()) {
    let handle: { remove: () => Promise<void> } | null = null;
    import("@capacitor/network").then(({ Network }) => {
      Network.addListener("networkStatusChange", (s) =>
        cb(s.connected ? "online" : "offline")
      ).then((h) => {
        handle = h;
      });
    });
    return () => {
      handle?.remove();
    };
  }

  const onOnline = () => cb("online");
  const onOffline = () => cb("offline");
  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
  }
  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    }
  };
}
