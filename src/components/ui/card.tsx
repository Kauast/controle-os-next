import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-line bg-panel p-5 shadow-[var(--shadow-panel)]",
        className,
      )}
      {...props}
    />
  );
}

function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{eyebrow}</span>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export { Card, SectionHeading };
