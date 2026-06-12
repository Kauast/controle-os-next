"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
  alert?: boolean;
  success?: boolean;
  warn?: boolean;
  icon?: React.ReactNode;
  index?: number;
  className?: string;
}

export function StatCard({
  label,
  value,
  hint,
  alert,
  success,
  warn,
  icon,
  index = 0,
  className,
}: StatCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className={cn(
        "relative overflow-hidden rounded-[16px] border border-line bg-panel p-4 shadow-[var(--shadow-panel)]",
        alert   && "border-red/30 bg-red-soft/20",
        success && "border-success/30 bg-success-soft/20",
        warn    && "border-amber/30 bg-amber-soft/20",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium leading-relaxed text-muted">{label}</span>
        {icon && (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg border border-line",
              alert   ? "border-red/20 text-red" : "",
              success ? "border-success/20 text-success" : "",
              warn    ? "border-amber/20 text-amber" : "",
              !alert && !success && !warn ? "text-muted" : "",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <strong
        className={cn(
          "mt-2 block text-[2rem] font-bold leading-none tracking-tight text-ink",
          alert   && "text-red",
          success && "text-success",
          warn    && "text-amber",
        )}
      >
        {value}
      </strong>
      {hint && <small className="mt-1.5 block text-xs text-muted">{hint}</small>}
    </motion.article>
  );
}
