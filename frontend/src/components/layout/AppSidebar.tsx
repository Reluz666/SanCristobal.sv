import {
  ChevronsUpDown,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { NAV_GROUPS } from "@/components/layout/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/use-sidebar";
import { getInitials, primaryRoleLabel } from "@/lib/identity";
import { FALLBACK_LOGO_URL, resolveBranding } from "@/lib/branding";
import { resolveTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/ui-store";

export function AppSidebar() {
  const { isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const company = useAuthStore((state) => state.company);
  const user = useAuthStore((state) => state.user);
  const roles = useAuthStore((state) => state.roles);
  const logout = useAuthStore((state) => state.logout);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const resolvedTheme = resolveTheme(theme);

  const branding = resolveBranding(company);
  const roleText = primaryRoleLabel(roles);
  const initials = getInitials(user?.name ?? "Usuario");

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => item.permission === undefined || hasPermission(item.permission),
    ),
  })).filter((group) => group.items.length > 0);

  const closeMobile = (): void => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    closeMobile();
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      {/* Clean Single Header: Company Logo + Name + Integrated Collapse Button */}
      <SidebarHeader className="border-b border-sidebar-border p-2.5">
        <div className="flex items-center justify-between gap-1.5 group-data-[collapsible=icon]:justify-center">
          <Link
            to="/"
            onClick={closeMobile}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:hidden hover:opacity-90 transition-opacity"
          >
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.name}
                className="size-8 shrink-0 rounded-full object-contain bg-white shadow-xs p-0.5"
              />
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary font-mono text-[11px] font-bold text-primary-foreground shadow-xs">
                {branding.shortName}
              </span>
            )}
            <span className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate text-xs font-bold text-sidebar-foreground">
                {branding.name}
              </span>
              <span className="mt-0.5 font-mono text-[10px] text-muted-foreground truncate">
                {company?.ruc ? `RUC ${company.ruc}` : ""}
              </span>
            </span>
          </Link>

          {/* Expanded mode: Collapse button inside sidebar */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden md:flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all cursor-pointer group-data-[collapsible=icon]:hidden shrink-0"
            title="Contraer menú lateral"
          >
            <PanelLeftClose className="size-4" strokeWidth={1.8} />
          </button>

          {/* Collapsed icon mode: Expand button right in header */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden group-data-[collapsible=icon]:flex size-8 items-center justify-center rounded-xl hover:bg-sidebar-accent text-primary transition-all cursor-pointer group/expand"
            title="Expandir menú lateral"
          >
            <img
              src={branding.logoUrl ?? FALLBACK_LOGO_URL}
              alt={branding.name}
              className="size-7 rounded-full object-contain bg-white p-0.5 shadow-xs group-hover/expand:hidden"
            />
            <PanelLeftOpen className="size-4 text-primary hidden group-hover/expand:block" strokeWidth={2} />
          </button>
        </div>
      </SidebarHeader>

      {/* Main Navigation (Clean, no duplicate tenant boxes) */}
      <SidebarContent className="pt-2">
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          "h-9 px-3 rounded-xl transition-all cursor-pointer font-medium text-xs",
                          active
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
                        )}
                      >
                        <NavLink to={item.to} onClick={closeMobile}>
                          <item.icon
                            className={cn(
                              "size-4 shrink-0 transition-colors",
                              active ? "text-primary" : "text-muted-foreground",
                            )}
                            strokeWidth={active ? 2 : 1.8}
                          />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.shortcut ? (
                            <Kbd
                              className={cn(
                                "ml-auto hidden h-4 px-1 font-mono text-[9px] group-data-[collapsible=icon]:hidden sm:inline-flex",
                                active
                                  ? "bg-primary/20 text-primary border-transparent"
                                  : "text-muted-foreground",
                              )}
                            >
                              {item.shortcut}
                            </Kbd>
                          ) : null}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer: Theme Toggle & User Account (No redundant debug boxes) */}
      <SidebarFooter className="border-t border-sidebar-border p-2 space-y-2">
        {/* Dark Mode Switch */}
        <div className="flex items-center justify-between rounded-xl border border-sidebar-border bg-sidebar-accent/30 px-3 py-2 text-xs group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 text-sidebar-foreground">
            {resolvedTheme === "dark" ? (
              <Moon className="size-3.5 text-primary" strokeWidth={1.8} />
            ) : (
              <Sun className="size-3.5 text-amber-500" strokeWidth={1.8} />
            )}
            <span id="theme-toggle-label" className="font-medium text-[11px]">Modo Oscuro</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={resolvedTheme === "dark"}
            aria-labelledby="theme-toggle-label"
            onClick={toggleTheme}
            className={cn(
              "relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
              resolvedTheme === "dark" ? "bg-primary" : "bg-zinc-300 dark:bg-zinc-700",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block size-3.5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out",
                resolvedTheme === "dark" ? "translate-x-3.5" : "translate-x-0",
              )}
            />
          </button>
        </div>

        {/* User Account Menu */}
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="h-10 rounded-xl cursor-pointer hover:bg-sidebar-accent">
                  <Avatar size="sm" className="size-7">
                    <AvatarFallback className="bg-primary font-mono text-[10px] font-bold text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {user?.name ?? "Usuario"}
                    </span>
                    <span className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {roleText}
                    </span>
                  </span>
                  <ChevronsUpDown
                    className="ml-auto size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
                    strokeWidth={1.5}
                  />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56 rounded-2xl">
                <DropdownMenuLabel className="axis-label text-[10px]">Cuenta Activa</DropdownMenuLabel>
                <DropdownMenuItem disabled className="font-normal">
                  <span className="truncate font-mono text-[10px]">{user?.email}</span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <span className="text-[11px] font-medium">{roleText}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 focus:text-red-700"
                  onSelect={() => {
                    void handleLogout();
                  }}
                >
                  <LogOut className="size-3.5 mr-1.5" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
