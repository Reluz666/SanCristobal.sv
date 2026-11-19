import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PanelProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * Sección con encabezado, descripción y acción opcionales.
 */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: PanelProps) {
  return (
    <section className={cn("flex flex-col rounded-md border bg-card", className)}>
      <header className="flex min-h-11 items-center justify-between gap-3 border-b px-4 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-medium text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn("flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
