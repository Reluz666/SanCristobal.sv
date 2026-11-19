import * as React from "react";
import {
  History,
  Search,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import {
  PAGE_META,
  DEFAULT_PAGE_META,
} from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatShortDate, formatTime } from "@/lib/datetime";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/ui-store";

export function Topbar() {
  const { pathname } = useLocation();
  const meta = PAGE_META[pathname] ?? DEFAULT_PAGE_META;
  const [now, setNow] = React.useState<Date>(() => new Date());

  const hasPermission = useAuthStore((state) => state.hasPermission);
  const toggleCommand = useUiStore((state) => state.toggleCommand);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-11 shrink-0 items-center gap-2 border-b border-border/70 bg-background/90 px-3.5 backdrop-blur-md">
      {/* Mobile-only Trigger: On desktop the collapse button is integrated inside the sidebar */}
      <SidebarTrigger className="-ml-1 size-7 text-muted-foreground hover:text-foreground transition-colors cursor-pointer md:hidden" />
      <Separator orientation="vertical" className="mx-1 h-4 md:hidden" />

      {/* Clean Breadcrumb */}
      <div className="min-w-0 items-center gap-1.5 text-xs flex">
        {pathname === "/" ? (
          <span className="font-medium text-foreground">Inicio</span>
        ) : (
          <>
            <span className="text-muted-foreground font-medium">{meta.section}</span>
            <span className="text-muted-foreground/40" aria-hidden="true">
              /
            </span>
            <span className="truncate font-semibold text-foreground">{meta.title}</span>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Command Palette Trigger */}
        <button
          type="button"
          onClick={toggleCommand}
          className="group hidden h-8 w-56 items-center gap-2 rounded-xl border border-border/80 bg-muted/30 px-2.5 text-xs text-muted-foreground outline-hidden transition-all hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring lg:flex xl:w-64 cursor-pointer"
          aria-label="Abrir paleta de comandos"
        >
          <Search className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
          <span className="flex-1 truncate text-left text-[11px]">Buscar comandos...</span>
          <Kbd className="h-4 bg-background px-1.5 font-mono text-[9px] border border-border/60">
            <span>⌘K</span>
          </Kbd>
        </button>

        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground lg:hidden cursor-pointer"
          onClick={toggleCommand}
          aria-label="Abrir paleta de comandos"
        >
          <Search className="size-4" strokeWidth={1.8} />
        </Button>

        {/* Audit link */}
        {hasPermission("users.view") && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground cursor-pointer"
                asChild
              >
                <Link to="/seguridad" aria-label="Actividad y auditoría">
                  <History className="size-4" strokeWidth={1.8} />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Historial de auditoría</TooltipContent>
          </Tooltip>
        )}

        {/* Clean Date & Clock */}
        <div className="hidden items-center gap-2 border-l border-border/60 pl-2.5 xl:flex font-mono text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground/80">{formatTime(now)}</span>
          <span className="text-[10px] text-muted-foreground/60">•</span>
          <span className="text-[10px] uppercase tracking-wider">{formatShortDate(now)}</span>
        </div>
      </div>
    </header>
  );
}
