import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  section?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-0.5 max-w-2xl text-xs sm:text-sm text-muted-foreground">{description}</p>
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-3">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
