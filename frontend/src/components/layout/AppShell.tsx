import * as React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { StatusBar } from "@/components/layout/StatusBar";
import { Topbar } from "@/components/layout/Topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/use-sidebar";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { applyTheme, watchSystemTheme } from "@/lib/theme";
import { useUiStore } from "@/stores/ui-store";

function AppShellFrame() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  const theme = useUiStore((state) => state.theme);
  const commandOpen = useUiStore((state) => state.commandOpen);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const isPos = pathname.startsWith("/pos");

  React.useEffect(() => {
    applyTheme(theme);

    if (theme !== "system") {
      return;
    }

    return watchSystemTheme(() => {
      applyTheme("system");
    });
  }, [theme]);

  React.useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  useHotkeys({
    COMMAND_PALETTE: () => {
      setCommandOpen(true);
    },
    F2: () => {
      if (!isPos) {
        setCommandOpen(true);
      }
    },
    F4: () => {
      if (!isPos) {
        navigate("/pos");
      }
    },
    F8: () => {
      if (!isPos) {
        navigate("/pos?cliente=1");
      }
    },
    ESCAPE: () => {
      if (commandOpen) {
        setCommandOpen(false);
      }
    },
  });

  return (
    <>
      <AppSidebar />
      <SidebarInset className="h-svh min-h-0 overflow-hidden">
        <Topbar />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1480px] p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
        <StatusBar />
      </SidebarInset>
      <CommandPalette />
    </>
  );
}

export function AppShell() {
  return (
    <SidebarProvider>
      <AppShellFrame />
    </SidebarProvider>
  );
}
