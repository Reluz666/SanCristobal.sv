import { useLocation } from "react-router-dom";
import { useHealth } from "@/hooks/use-health";
import { formatTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

const APP_VERSION = "0.1.0";

export function StatusBar() {
  const health = useHealth();
  const { pathname } = useLocation();
  const isPos = pathname === "/pos";

  const healthLabel = health.isSuccess
    ? "API Operativa"
    : health.isError
      ? "API Sin Conexión"
      : "Verificando...";

  const dotClass = health.isSuccess
    ? "bg-emerald-500"
    : health.isError
      ? "bg-red-500"
      : "bg-amber-500";

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-border/60 bg-muted/20 px-3.5 text-[10px] text-muted-foreground select-none">
      <div className="flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full", dotClass)} aria-hidden="true" />
        <span className="font-semibold text-foreground/80">{healthLabel}</span>
      </div>

      <span className="hidden h-3 w-px bg-border/60 sm:block" aria-hidden="true" />

      <span className="hidden font-mono tabular-nums sm:inline text-muted-foreground/70">
        {health.data ? `${String(health.data.latencyMs)} ms` : "-- ms"}
      </span>
      <span className="hidden font-mono md:inline text-muted-foreground/60">v1</span>

      <div className="ml-auto flex items-center gap-3">
        {/* Contextual Hotkeys */}
        {isPos ? (
          <>
            <span className="hidden items-center gap-1.5 md:flex">
              <kbd className="rounded-sm border border-border/80 bg-background px-1 font-mono text-[9px] font-bold">F2</kbd>
              Buscar
            </span>
            <span className="hidden items-center gap-1.5 lg:flex">
              <kbd className="rounded-sm border border-border/80 bg-background px-1 font-mono text-[9px] font-bold text-primary">F4</kbd>
              Cobrar
            </span>
            <span className="hidden items-center gap-1.5 xl:flex">
              <kbd className="rounded-sm border border-border/80 bg-background px-1 font-mono text-[9px] font-bold">F8</kbd>
              Cliente
            </span>
            <span className="hidden h-3 w-px bg-border/60 xl:block" aria-hidden="true" />
          </>
        ) : (
          <>
            <span className="hidden items-center gap-1.5 md:flex text-muted-foreground/80">
              <kbd className="rounded-sm border border-border/80 bg-background px-1 font-mono text-[9px]">⌘K</kbd>
              Paleta de Comandos
            </span>
            <span className="hidden h-3 w-px bg-border/60 md:block" aria-hidden="true" />
          </>
        )}

        <span className="hidden sm:inline text-muted-foreground/70 font-mono">
          {health.isSuccess
            ? `Sync ${formatTime(new Date(health.dataUpdatedAt))}`
            : "Desconectado"}
        </span>
        <span className="font-mono text-muted-foreground/60">v{APP_VERSION}</span>
      </div>
    </footer>
  );
}
