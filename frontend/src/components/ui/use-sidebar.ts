import * as React from "react";

import { SidebarContext } from "@/components/ui/sidebar-context";
import type { SidebarContextProps } from "@/components/ui/sidebar-context";

export function useSidebar(): SidebarContextProps {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar debe usarse dentro de <SidebarProvider>.");
  }

  return context;
}
