import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-panel)]",
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
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <span className="label-eyebrow">{eyebrow}</span>
        <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export { Card, SectionHeading };
