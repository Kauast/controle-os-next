"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { SidebarNav } from "./sidebar";
import { useAppStore } from "@/store/use-app-store";
import { useUIStore } from "@/store/use-ui-store";
import type { SectionKey } from "@/lib/access";

export function MobileSidebar() {
  const role = useAppStore((s) => s.role);
  const { section, setSection, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore();

  function navigate(key: SectionKey) {
    setSection(key, null);
    setMobileSidebarOpen(false);
  }

  return (
    <AnimatePresence>
      {mobileSidebarOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />

          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col gap-6 border-r border-line bg-panel-soft p-4 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                  <Image src="/logo.svg" alt="RB Segurança" width={28} height={28} className="rounded-lg" />
                </div>
                <div className="leading-tight">
                  <p className="text-base font-black tracking-tight text-ink">RB</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted">Segurança</p>
                </div>
              </div>

              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-white/10 hover:text-ink"
                aria-label="Fechar menu"
              >
                <X className="size-4" />
              </button>
            </div>

            <SidebarNav section={section} role={role} onNavigate={navigate} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
