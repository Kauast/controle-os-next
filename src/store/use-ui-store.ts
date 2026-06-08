"use client";

import { create } from "zustand";
import type { SectionKey } from "@/lib/access";

interface UIState {
  section: SectionKey;
  stockTarget: string | null;
  newOsOpen: boolean;
  scheduleOpen: boolean;
  teamLoginOpen: boolean;
  setSection: (section: SectionKey, stockTarget?: string | null) => void;
  setNewOsOpen: (open: boolean) => void;
  setScheduleOpen: (open: boolean) => void;
  setTeamLoginOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  section: "painel",
  stockTarget: null,
  newOsOpen: false,
  scheduleOpen: false,
  teamLoginOpen: false,
  setSection: (section, stockTarget = null) => set({ section, stockTarget }),
  setNewOsOpen: (open) => set({ newOsOpen: open }),
  setScheduleOpen: (open) => set({ scheduleOpen: open }),
  setTeamLoginOpen: (open) => set({ teamLoginOpen: open }),
}));
