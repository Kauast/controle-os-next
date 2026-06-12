import { Capacitor } from "@capacitor/core";

export function isClientSide() {
  return typeof window !== "undefined";
}

export function isCapacitorApp() {
  return isClientSide() && Capacitor.isNativePlatform();
}

export function getClientPlatform() {
  if (!isClientSide()) {
    return "server";
  }

  return isCapacitorApp() ? Capacitor.getPlatform() : "web";
}
